/* Copyright © 2026 VELORYZ. All rights reserved. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validMonthlyPrice, verifiedSubscription, subscriptionEligible, monthlyCheckoutParams} from './subscriptions.ts';
const price = {id:'price_AbCd123',active:true,currency:'inr',unit_amount:1000,type:'recurring',livemode:false,recurring:{interval:'month',interval_count:1}};
test('monthly checkout requires real monthly Stripe price and matching mode',()=>{
 assert.equal(validMonthlyPrice(price,price.id,'inr',false),true);
 assert.equal(validMonthlyPrice({...price,type:'one_time'},price.id,'inr',false),false);
 assert.equal(validMonthlyPrice({...price,recurring:{interval:'week',interval_count:1}},price.id,'inr',false),false);
 assert.equal(validMonthlyPrice(price,price.id,'usd',false),false);
 assert.equal(validMonthlyPrice(price,price.id,'inr',true),false);
 const params=monthlyCheckoutParams({userId:'d0f389f5-e454-4389-a9d7-81e3f423f7c9',priceId:price.id},'https://example.org');
 assert.equal(params.get('mode'),'subscription');assert.equal(params.get('metadata[veloriPlan]'),'PRO_MONTHLY');
 assert.throws(()=>monthlyCheckoutParams({userId:'bad',priceId:price.id},'http://evil.test'));
});
test('canonical subscription requires matching verified price and period',()=>{
 const sub={id:'sub_Test123',customer:'cus_Test123',livemode:false,status:'active',items:{data:[{price:{id:price.id},current_period_end:Math.round(Date.now()/1000)+300}]}};
 assert.equal(verifiedSubscription(sub,price.id,false),true);
 assert.equal(verifiedSubscription(sub,'price_Other',false),false);
 assert.equal(verifiedSubscription({...sub,livemode:true},price.id,false),false);
 assert.equal(verifiedSubscription({...sub,items:{data:[{price:{id:price.id},current_period_end:1}]}},price.id,false),true); // expired subscriptions must still be saved as canceled, not retried endlessly
 assert.equal(subscriptionEligible('active',Math.round(Date.now()/1000)+500),true);
 assert.equal(subscriptionEligible('past_due',Math.round(Date.now()/1000)+500),false);
 assert.equal(subscriptionEligible('active',1),false);
});
