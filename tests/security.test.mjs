
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {allowedUrl,escapeHtml,cleanText,findLinks} from '../api/preview.mjs';
import {validStripeSignature} from '../api/webhook.mjs';
test('reader accepts approved public HTTPS and rejects arbitrary hosts',()=>{
 assert.equal(allowedUrl('https://en.wikipedia.org/wiki/Test')?.hostname,'en.wikipedia.org');
 for(const url of ['http://en.wikipedia.org','https://127.0.0.1/','https://localhost/','https://example.com:8443/','https://evil.test/','https://example.com@evil.test/','file:///etc/passwd'])
   assert.equal(allowedUrl(url),null,url);
});
test('HTML markup from remote pages is escaped before rendering',()=>{
 assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
 const value=cleanText('<head><title>No</title></head><h1>Hello</h1><script>alert(1)</script><p>world</p>');
 assert.equal(value.includes('alert(1)'),false);
 assert.equal(value.includes('Hello'),true);
});
test('reader only includes approved same-allowlist links',()=>{
 const html='<a href="/wiki/Science">Science</a><a href="https://malicious.invalid">Unknown</a>';
 const links=findLinks(html,new URL('https://en.wikipedia.org/wiki/Main_Page'));
 assert.equal(links.length,1);
 assert.equal(links[0].url,'https://en.wikipedia.org/wiki/Science');
});
test('Stripe webhook signature validates timing and payload',()=>{
 const raw='{"type":"test"}',secret='whsec_testing',t=1800000000;
 const sig=createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
 assert.equal(validStripeSignature(raw,'t='+t+',v1='+sig,secret,t),true);
 assert.equal(validStripeSignature(raw+'x','t='+t+',v1='+sig,secret,t),false);
 assert.equal(validStripeSignature(raw,'t='+t+',v1='+sig,secret,t+600),false);
});
