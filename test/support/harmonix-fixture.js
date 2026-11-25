import express from 'express';
import crypto from 'node:crypto';
export async function createHarmonixFixture() {
  const app = express(); app.use(express.json());
  const pending = new Map(), access = new Map(), refresh = new Map();
  const controls = { user:'alice', hubBase:'', expiresIn:900, refreshCalls:0, revoked:0, releasesStatus:200, resumeStatus:200, imageType:'image/png', cover:'/covers/test.png', empty:false };
  const row = { id:'song-1', title:'Musique <test>', artist:'Artiste & invité', cover:'/covers/test.png', release_date:'2026-11-01', position_ms:42000, duration_ms:180000 };
  const pair = user => {
    const a = crypto.randomUUID(), r = crypto.randomUUID(); access.set(a,user); refresh.set(r,user);
    return {access_token:a,refresh_token:r,expires_in:controls.expiresIn};
  };
  app.get('/api/harmonix/apps/v2/sso/start',(req,res)=> {
    pending.set(req.query.state,{ challenge:req.query.code_challenge, user:controls.user });
    res.json({ok:true,data:{authorize_url:base+'/authorize?'+new URLSearchParams({state:req.query.state})}});
  });
  app.get('/authorize',(req,res)=>res.redirect(303,controls.hubBase+'/api/connectors/harmonix/callback?'+new URLSearchParams({state:req.query.state})));
  app.get('/api/harmonix/apps/v2/sso/status',(req,res)=> {
    const entry = pending.get(req.query.state), verifier = req.get('x-sonora-code-verifier');
    if (!entry || !verifier || crypto.createHash('sha256').update(verifier).digest('base64url') !== entry.challenge) return res.sendStatus(404);
    pending.delete(req.query.state); res.json({ok:true,data:pair(entry.user)});
  });
  app.post('/auth/refresh',(req,res)=> {
    const user = refresh.get(req.body.refresh_token); if (!user) return res.sendStatus(401);
    controls.refreshCalls++; refresh.delete(req.body.refresh_token); res.json(pair(user));
  });
  app.post('/auth/revoke',(req,res)=> { refresh.delete(req.body.refresh_token); controls.revoked++; res.json({ok:true}); });
  app.use((req,res,next)=> { req.user = access.get((req.get('authorization') || '').replace(/^Bearer /,'')); if (!req.user) return res.sendStatus(401); next(); });
  app.get('/api/auth/me',(req,res)=>res.json({id:req.user}));
  app.get('/api/hub/music/releases',(_req,res)=>res.status(controls.releasesStatus).json({ok:true,data:controls.empty ? [] : [row]}));
  app.get('/api/hub/music/resume',(_req,res)=>res.status(controls.resumeStatus).json({ok:true,data:controls.empty ? null : row}));
  app.get('/api/harmonix/apps/v2/catalog/tracks/:id',(_req,res)=>res.json({ok:true,data:{...row,cover_file:controls.cover}}));
  app.get('/covers/test.png',(_req,res)=>res.type(controls.imageType).send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')));
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  return { base, controls, pending, row, close:()=>new Promise(resolve=>server.close(resolve)) };
}
