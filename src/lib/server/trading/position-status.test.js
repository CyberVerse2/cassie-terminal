import test from 'node:test';
import assert from 'node:assert/strict';
import {positionStatus} from './position-status.js';
const intent={address:'wallet',asset:'asset'};
function fixture(){return {entry:{order:{orderId:'entry',funderAddress:'wallet',targetAsset:{address:'asset'},side:'buy',status:'ORDER_STATUS_FILLED',filled:{targetAmount:'1'}},fills:[{status:'CHAIN_STATUS_FINALIZED'}]},exit:{order:{sourceEntryOrderId:'entry',funderAddress:'wallet',targetAsset:{address:'asset'},side:'sell',status:'ORDER_STATUS_FILLED',filled:{targetAmount:'1'}},fills:[{status:'CHAIN_STATUS_FINALIZED'}]}};}
test('a filled entry keeps capital reserved',()=>{const {entry}=fixture();assert.equal(positionStatus(entry,null,intent),'open');});
test('a finalized round trip releases capital',()=>{const {entry,exit}=fixture();assert.equal(positionStatus(entry,exit,intent),'closed');});
test('a partial exit retains capital, including sub-float differences',()=>{const {entry,exit}=fixture();exit.order.filled.targetAmount='0.999999999999999999';assert.equal(positionStatus(entry,exit,intent),'needs_review');});
test('an unfinalized exit retains capital',()=>{const {entry,exit}=fixture();exit.fills[0].status='CHAIN_STATUS_PROCESSED';assert.equal(positionStatus(entry,exit,intent),'needs_review');});
test('another wallet cannot supply closure evidence',()=>{const {entry,exit}=fixture();exit.order.funderAddress='other';assert.throws(()=>positionStatus(entry,exit,intent));});
test('an unfilled cancelled entry releases its reservation',()=>{const {entry}=fixture();entry.order.status='ORDER_STATUS_CANCELLED';entry.order.filled=null;entry.fills=[];assert.equal(positionStatus(entry,null,intent),'rejected');});
