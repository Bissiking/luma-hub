import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

Object.assign(process.env,{NODE_ENV:'test',PUBLIC_BASE_URL:'http://localhost:4321',DOTENV_CONFIG_PATH:path.resolve('test/fixtures/no-env')});
const auth=await import('../src/session.js');
const {SsoError,isTransientKyrosError}=await import('../src/sso.js');

test('OAuth binding is random, opaque and required when creating a transaction',()=>{
  const first=auth.newOAuthBrowserBinding(),second=auth.newOAuthBrowserBinding();
  assert.equal(auth.isOAuthBrowserBinding(first),true);assert.notEqual(first,second);
  for(const value of [null,undefined,{},[],true,'short','x'.repeat(42),'x'.repeat(44),'!'.repeat(43)])assert.equal(auth.isOAuthBrowserBinding(value),false);
  assert.throws(()=>auth.createOAuthTransaction({codeVerifier:'fixture'}),TypeError);
});

test('a foreign browser cannot consume or invalidate the legitimate OAuth transaction',()=>{
  const binding=auth.newOAuthBrowserBinding(),other=auth.newOAuthBrowserBinding();
  const state=auth.createOAuthTransaction({returnTo:'/applications?q=test#section',codeVerifier:'fixture',scope:'profile',browserBinding:binding});
  for(const value of [undefined,'',other])assert.equal(auth.consumeOAuthTransaction(state,value),null);
  const result=auth.consumeOAuthTransaction(state,binding);assert.equal(result.returnTo,'/applications?q=test#section');assert.equal(result.codeVerifier,'fixture');
  assert.equal(auth.consumeOAuthTransaction(state,binding),null);
});

test('same-browser concurrent OAuth transactions remain independent',()=>{
  const binding=auth.newOAuthBrowserBinding();
  const first=auth.createOAuthTransaction({browserBinding:binding,codeVerifier:'one'}),second=auth.createOAuthTransaction({browserBinding:binding,codeVerifier:'two'});
  assert.equal(auth.consumeOAuthTransaction(second,binding).codeVerifier,'two');assert.equal(auth.consumeOAuthTransaction(first,binding).codeVerifier,'one');
});

test('expired OAuth transactions are refused even with the correct browser binding',t=>{
  const now=Date.now(),binding=auth.newOAuthBrowserBinding(),state=auth.createOAuthTransaction({browserBinding:binding,codeVerifier:'fixture'});
  t.mock.method(Date,'now',()=>now+600001);assert.equal(auth.consumeOAuthTransaction(state,binding),null);
});

test('local return paths preserve query/fragment and reject external or malformed targets',()=>{
  for(const value of ['https://foreign.invalid','//foreign.invalid','/\\foreign.invalid','/path\\other','/\r\nother','/\u0000other',null,{},'/'.repeat(8193)])assert.equal(auth.safeReturnTo(value),'/');
  assert.equal(auth.safeReturnTo('/catalog?q=a#item'),'/catalog?q=a#item');
});

test('temporary Kyros failures remain distinct from invalid credentials or grants',()=>{
  for(const error of [new SsoError('kyros_timeout','',504),new SsoError('kyros_unreachable','',502),new SsoError('temporarily_unavailable','',400),new SsoError('http_503','',503),new SsoError('limited','',429)])assert.equal(isTransientKyrosError(error),true);
  for(const error of [new SsoError('invalid_grant','',400),new SsoError('token_invalid','',401),new SsoError('access_denied','',403),new Error('unknown')])assert.equal(isTransientKyrosError(error),false);
});

test('browser binding cookie stays HttpOnly, same-site lax and restricted to auth routes',()=>{
  const options=auth.oauthBindingCookieOptions();assert.equal(options.httpOnly,true);assert.equal(options.sameSite,'lax');assert.equal(options.path,'/auth');assert.equal(options.maxAge,600000);
});
