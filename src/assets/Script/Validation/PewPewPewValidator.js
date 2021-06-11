var AnglePositionCalculator=function(t){this.angleSpeed=0,this.lastAngle=t,this.lastChangeAt=0,this.isStarted=!1,this.start=function(t,e,i){0==this.isStarted&&(this.updateChanges(t,e,i),this.isStarted=!0)},this.updateChanges=function(t,e,i){this.angleSpeed=e,this.lastAngle=i,this.lastChangeAt=t},this.getAnglePosition=function(t){return 0==this.isStarted?this.lastAngle:this.lastAngle+.001*(t-this.lastChangeAt)*this.angleSpeed}},PewPewPewDataDeSerializer=function(){this.deserialize_EVENT_START_GAME=function(t){return t},this.deserialize_EVENT_END_GAME=function(t){return t},this.deserialize_EVENT_SPAWN_MONSTER=function(t){return{id:t[0],speed:t[1],angle:t[2]}},this.deserialize_EVENT_START_MONSTER=function(t){return{id:t[0],speed:t[1],angle:t[2]}},this.deserialize_EVENT_UPDATE_MONSTER=function(t){return{id:t[0],speed:t[1],angle:t[2]}},this.deserialize_EVENT_DESTROY_MONSTER=function(t){return{id:t[0]}},this.deserialize_EVENT_HIT_MONSTER=function(t){return{id:t[0],speed:t[1],angle:t[2],bulletShootTime:t[3],metadata:t[4]}},this.deserialize_EVENT_HIT_GLOBE=function(t){return t},this.deserializeEvent=function(t){const e=t[0],i=t[1],s=t[2];var n={};switch(e){case 0:n=this.deserialize_EVENT_START_GAME(s);break;case 1:n=this.deserialize_EVENT_END_GAME(s);break;case 2:n=this.deserialize_EVENT_SPAWN_MONSTER(s);break;case 3:n=this.deserialize_EVENT_START_MONSTER(s);break;case 4:n=this.deserialize_EVENT_UPDATE_MONSTER(s);break;case 5:n=this.deserialize_EVENT_DESTROY_MONSTER(s);break;case 6:n=this.deserialize_EVENT_HIT_MONSTER(s);break;case 7:n=this.deserialize_EVENT_HIT_GLOBE(s);break;default:return null}return{code:e,time:i,data:n}},this.deserialize=function(t){if(null==t||0==Array.isArray(t))return null;const e=[];for(var i=0;i<t.length;i++){const s=this.deserializeEvent(t[i]);if(null==s)return null;e.push(s)}return e}},Monster=function(t,e){this.id=t,this.anglePositionCalculator=new AnglePositionCalculator(e),this.start=function(t,e,i){this.anglePositionCalculator.start(t,e,i)},this.getAnglePosition=function(t){return this.anglePositionCalculator.getAnglePosition(t)},this.updateChanges=function(t,e,i){this.anglePositionCalculator.updateChanges(t,e,i)}},PewPewPewValidator=function(){this.state=0,this.monsters=[],this.score=0,this.comboCount=0,this.getResult=function(t,e,i){return 0==t&&console.log("@@=> ERROR!!, "+e),{success:!0,info:e,score:!0===t?i:-1}},this.getSuccess=function(){return this.getResult(!0,"OK",this.score)},this.getFaiure=function(t){return this.getResult(!1,t,-1)},this.getMonsterById=function(t){for(var e=0;e<this.monsters.length;e++)if(this.monsters[e].id==t)return this.monsters[e];return null},this.validate=function(t){if(null==t||!1===Array.isArray(t))return this.getFaiure("Invalid event data to start the validation!");var e=(new PewPewPewDataDeSerializer).deserialize(t);if(null==e)return this.getFaiure("Invalid event data list when process the deserialization!");if(e.length<2)return this.getFaiure("Required at least 2 events (start and end)!");if(0!=e[0].code)return this.getFaiure("First event must be start game event!");if(1!=e[e.length-1].code)return this.getFaiure("Last event must be end game event!");for(var i=1;i<e.length-2;i++)if(0==this.validateEvent(e[i]))return this.getFaiure("Failed to validate event at index "+i);return this.getSuccess()},this.validateEvent=function(t){const e=t.code,i=t.time,s=t.data;switch(e){case 0:return 0==this.state?(this.state=1,this.getSuccess()):this.getFaiure("[EVENT_START_GAME] Game is started or finished!");case 1:return 1==this.state?(this.state=2,this.getSuccess()):this.getFaiure("[EVENT_END_GAME] Game is not started or already finished!");case 2:return null!=(r=this.getMonsterById(s.id))?this.getFaiure("Monster with id "+s.id+" has already spawned!"):(r=new Monster(s.id,s.angle),this.monsters.push(r),this.getSuccess());case 3:return null==(r=this.getMonsterById(s.id))?this.getFaiure("Monster with id "+s.id+" not found!"):(r.start(i,s.speed,s.angle),this.getSuccess());case 4:return null==(r=this.getMonsterById(s.id))?this.getFaiure("Monster with id "+s.id+" not found!"):(r.updateChanges(i,s.speed,s.angle),this.getSuccess());case 5:for(var n=this.monsters.length-1;n>=0;n--)if(this.monsters[n].id==s.id)return this.monsters.splice(n,1),this.getSuccess();return this.getFaiure("Monster with id "+s.id+" not found!");case 6:var r;if(null==(r=this.getMonsterById(s.id)))return this.getFaiure("Monster with id "+s.id+" not found!");{const t=r.getAnglePosition(i);return Math.abs(t-s.angle)>5?this.getFaiure("Failed to kill monster, the angle of monster is not correct: expect "+t+", actual: "+s.angle):(this.comboCount++,this.score+=this.comboCount,this.getSuccess())}case 7:return this.comboCount=0,this.score>0&&this.score--,this.getSuccess()}}},ValidatorFactory=function(){this.createAnglePositionCalculator=function(t){return new AnglePositionCalculator(t)},this.createPewPewPewValidator=function(){return new PewPewPewValidator}},validatorFactory=new ValidatorFactory;