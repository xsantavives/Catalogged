#!/usr/bin/env python3
"""Persistent review/repair budget; only trusted, serialized GitHub Actions writes."""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

PREFIX = '<!-- XSV_REVIEW_BUDGET_V1 -->\n' + chr(96)*3 + 'json\n'
SUFFIX = '\n' + chr(96)*3
HEX40 = re.compile(r'^[0-9a-f]{40}$')
ISSUE = re.compile(r'^XSV-[1-9][0-9]*$')
VERDICTS = {'ACCEPTED_FOR_OWNER_GATE', 'CHANGES_REQUESTED', 'BLOCKED_HUMAN_DECISION_REQUIRED'}

class Blocked(Exception):
    pass

def utc():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def empty(repo, pr, issue):
    return dict(schema_version=1, repository=repo, pr_number=pr, linear_issue=issue,
                review_rounds=0, repair_rounds=0, active=None, last_reviewed_sha=None,
                last_verdict=None, events=[])

def validate(s, repo, pr, issue):
    if not isinstance(s, dict) or s.get('schema_version') != 1:
        raise Blocked('Invalid ledger schema')
    if any(s.get(k)!=v for k,v in [('repository',repo),('pr_number',pr),('linear_issue',issue)]):
        raise Blocked('Ledger identity mismatch')
    r,p=s.get('review_rounds'),s.get('repair_rounds')
    if type(r)!=int or type(p)!=int or r not in (0,1,2) or p not in (0,1):
        raise Blocked('Invalid budget counts')
    events=s.get('events')
    if not isinstance(events,list) or len(events)>12 or any(not isinstance(e,dict) for e in events):
        raise Blocked('Invalid ledger history')
    if sum(e.get('operation')=='reserve-review' for e in events)!=r or sum(e.get('operation')=='reserve-repair' for e in events)!=p:
        raise Blocked('Counters conflict with ledger')
    if not isinstance(s.get('active'),(dict,type(None))):
        raise Blocked('Invalid active reservation')
    return s

def advance(s,op,sha,run_id,reservation='',verdict='',review_id='',evidence=None):
    s=json.loads(json.dumps(s))
    if not HEX40.fullmatch(sha): raise Blocked('Invalid current PR SHA')
    if op=='status': return s
    active=s['active']
    if op in ('reserve-review','reserve-repair'):
        if active: raise Blocked('Active reservation requires owner reconciliation')
        if not run_id or any(e.get('reservation_id')==run_id for e in s['events']):
            raise Blocked('Missing or duplicate reservation ID')
        if op=='reserve-review':
            if s['review_rounds']>=2 or s['last_verdict'] in ('ACCEPTED_FOR_OWNER_GATE','BLOCKED_HUMAN_DECISION_REQUIRED'):
                raise Blocked('Review budget exhausted or delivery closed')
            if s['review_rounds']==1:
                if s['repair_rounds']!=1 or not any(e['operation']=='finish-repair' for e in s['events']):
                    raise Blocked('Authorized repair must complete before review two')
                if s['last_reviewed_sha']==sha: raise Blocked('Second review requires new HEAD')
            s['review_rounds']+=1
        else:
            if s['review_rounds']!=1 or s['repair_rounds']!=0 or s['last_verdict']!='CHANGES_REQUESTED':
                raise Blocked('Repair budget unavailable')
            if s['last_reviewed_sha']!=sha: raise Blocked('Repair must start on reviewed SHA')
            s['repair_rounds']+=1
        s['active']=dict(operation=op,reservation_id=run_id,sha=sha)
        s['events'].append(dict(operation=op,reservation_id=run_id,sha=sha,at=utc()))
        return s
    if op not in ('finish-review','finish-repair'):
        raise Blocked('Unknown operation')
    if not active or active.get('operation')!=op.replace('finish','reserve') or active.get('reservation_id')!=reservation:
        raise Blocked('No matching reservation')
    if op=='finish-review':
        if sha!=active['sha']: raise Blocked('Review was conducted on stale HEAD')
        if verdict not in VERDICTS or not review_id or not evidence:
            raise Blocked('Submitted independent GitHub review evidence required')
        if s['review_rounds']==2 and verdict=='CHANGES_REQUESTED':
            verdict='BLOCKED_HUMAN_DECISION_REQUIRED'
        s['last_reviewed_sha']=sha
        s['last_verdict']=verdict
        event=dict(operation=op,reservation_id=reservation,sha=sha,review_id=str(review_id),verdict=verdict,at=utc())
    else:
        if sha==active['sha']: raise Blocked('Repair did not change PR HEAD')
        event=dict(operation=op,reservation_id=reservation,sha=sha,original_sha=active['sha'],at=utc())
    s['active']=None
    s['events'].append(event)
    return s

def unpack(body):
    if not isinstance(body,str) or not body.startswith(PREFIX) or not body.endswith(SUFFIX):
        raise Blocked('Malformed ledger marker')
    try: return json.loads(body[len(PREFIX):-len(SUFFIX)])
    except ValueError: raise Blocked('Malformed ledger JSON') from None

def pack(s):
    return PREFIX+json.dumps(s,sort_keys=True,indent=2)+SUFFIX

class GitHub:
    def __init__(self,repo,token):
        if not token or not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo):
            raise Blocked('Missing GitHub credentials or invalid repository')
        self.repo,self.token=repo,token
        self.ledger_issue=int(os.environ.get('XSV_LEDGER_ISSUE','0'))
        if self.ledger_issue<=0: raise Blocked('Missing fixed ledger issue ID')

    def api(self,method,path,body=None):
        data=json.dumps(body).encode() if body is not None else None
        req=urllib.request.Request('https://api.github.com/repos/'+self.repo+path,data=data,method=method,headers={
            'Authorization':'Bearer '+self.token, 'Accept':'application/vnd.github+json',
            'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json',
            'User-Agent':'xsv-review-budget/1'})
        try:
            with urllib.request.urlopen(req,timeout=15) as res: return json.load(res)
        except urllib.error.HTTPError as exc:
            raise Blocked('GitHub API refused request (HTTP '+str(exc.code)+')') from None
        except (OSError,ValueError):
            raise Blocked('GitHub API request failed') from None

    def pages(self,path):
        out=[]
        for page in range(1,6):
            data=self.api('GET',path+'?per_page=100&page='+str(page))
            if not isinstance(data,list): raise Blocked('Invalid GitHub list response')
            out.extend(data)
            if len(data)<100: return out
        raise Blocked('Incomplete GitHub pagination; blocked')

    def pr(self,num):
        p=self.api('GET','/pulls/'+str(num))
        if p.get('state')!='open' or p.get('merged_at') or not HEX40.fullmatch(p.get('head',{}).get('sha','')):
            raise Blocked('PR not open/unmerged or invalid HEAD')
        if p.get('head',{}).get('repo',{}).get('full_name')!=self.repo:
            raise Blocked('Cross-repository PR not authorized')
        return p

    def ledger(self,num,issue):
        # A shared GitHub issue stores one state per Linear issue, across ALL PRs.
        rows=self.pages('/issues/'+str(self.ledger_issue)+'/comments')
        found=[]
        for c in rows:
            body=c.get('body')
            if not isinstance(body,str) or not body.startswith('<!-- XSV_REVIEW_BUDGET_V1'): continue
            state=unpack(body)
            if state.get('pr_number')==num and state.get('linear_issue')!=issue:
                raise Blocked('PR already bound to another Linear issue; budget cannot reset')
            if state.get('linear_issue')==issue: found.append((c,state))
        if len(found)>1: raise Blocked('Duplicate Linear issue ledgers; owner reconciliation required')
        if not found: return None,empty(self.repo,num,issue)
        c,state=found[0]
        if c.get('user',{}).get('login')!='github-actions[bot]': raise Blocked('Untrusted ledger author')
        # A second PR for the same Linear issue MUST NOT restart the delivery budget.
        return c['id'],validate(state,self.repo,num,issue)

    def previous_reviews(self,num):
        return [r for r in self.pages('/pulls/'+str(num)+'/reviews')
                if r.get('state') in ('COMMENTED','CHANGES_REQUESTED','APPROVED')]

    def reviewed(self,num,rid,sha,verdict):
        matches=[r for r in self.previous_reviews(num) if str(r.get('id'))==str(rid)]
        if len(matches)!=1: raise Blocked('Submitted review ID not found')
        r=matches[0]
        if r.get('commit_id')!=sha or 'XSV_INDEPENDENT_REVIEW' not in (r.get('body') or ''):
            raise Blocked('Review marker/SHA mismatch')
        claimed=re.search(r'(?im)^\s*VERDICT\s*:\s*(PASS|ACCEPTED_FOR_OWNER_GATE|CHANGES_REQUESTED|BLOCKED_HUMAN_DECISION_REQUIRED)\s*$',
                          r.get('body') or '')
        if not claimed or {'PASS':'ACCEPTED_FOR_OWNER_GATE'}.get(claimed.group(1),claimed.group(1))!=verdict:
            raise Blocked('Review verdict mismatch')
        return r

    def save(self,num,cid,s):
        body=dict(body=pack(s))
        return self.api('PATCH','/issues/comments/'+str(cid),body) if cid else self.api('POST','/issues/'+str(self.ledger_issue)+'/comments',body)

def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument('--operation',required=True,choices=['status','reserve-review','finish-review','reserve-repair','finish-repair'])
    p.add_argument('--pr',type=int,required=True)
    p.add_argument('--linear-issue',required=True)
    p.add_argument('--sha',default='')
    p.add_argument('--reservation-id',default='')
    p.add_argument('--review-id',default='')
    p.add_argument('--verdict',default='')
    a=p.parse_args(argv)
    try:
        if a.pr<1 or not ISSUE.fullmatch(a.linear_issue): raise Blocked('Invalid PR/Linear issue ID')
        if os.environ.get('GITHUB_REF')!='refs/heads/main' or os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch':
            raise Blocked('Not trusted main workflow_dispatch')
        gh=GitHub(os.environ.get('GITHUB_REPOSITORY',''),os.environ.get('GH_TOKEN',''))
        pr=gh.pr(a.pr)
        # Pin input issue to the uniquely declared delivery at the PR header.
        intro=(pr.get('title') or '')+'\n'+'\n'.join((pr.get('body') or '').splitlines()[:4])
        declared=set(re.findall(r'\bXSV-[1-9][0-9]*\b',intro))
        if a.operation!='status' and declared!={a.linear_issue}:
            raise Blocked('PR title/introduction must declare one matching XSV issue')
        sha=pr['head']['sha']
        if a.operation!='status' and not a.sha: raise Blocked('Expected SHA required for mutation')
        if a.sha and a.sha!=sha: raise Blocked('HEAD SHA changed before gate')
        cid,s=gh.ledger(a.pr,a.linear_issue)
        if a.operation=='status':
            print(json.dumps(dict(status='OK' if cid else 'NOT_INITIALIZED',ledger=s),sort_keys=True))
            return 0
        if cid is None and a.operation=='reserve-review' and gh.previous_reviews(a.pr):
            raise Blocked('Existing formal PR reviews require owner migration before first reservation')
        run_id=os.environ.get('GITHUB_RUN_ID','')+'-'+os.environ.get('GITHUB_RUN_ATTEMPT','')
        evidence=gh.reviewed(a.pr,a.review_id,sha,a.verdict) if a.operation=='finish-review' else None
        s=advance(s,a.operation,sha,run_id,a.reservation_id,a.verdict,a.review_id,evidence)
        gh.save(a.pr,cid,s)
        print(json.dumps(dict(status='PERSISTED',operation=a.operation,
                              reservation_id=s['active']['reservation_id'] if s['active'] else a.reservation_id,
                              review_rounds=s['review_rounds'],repair_rounds=s['repair_rounds'],
                              sha=sha,verdict=s['last_verdict']),sort_keys=True))
        return 0
    except Blocked as exc:
        print('BLOCKED: '+str(exc),file=sys.stderr)
        return 2
    except Exception:
        print('BLOCKED: internal failure; no success claimed',file=sys.stderr)
        return 2

if __name__=='__main__':
    sys.exit(main())
