const PHYSICS_PATTERN =
  /function ([A-Za-z_$][\w$]*)\(e,t,n,r,i=([A-Za-z_$][\w$]*)\)\{/;
const PLAYER_STEP_PATTERN =
  /([A-Za-z_$][\w$]*)\(this\.state,([A-Za-z_$][\w$]*)\?([A-Za-z_$][\w$]*)\.onfoot\.horseIntent\(this\.state,([A-Za-z_$][\w$]*)\):([A-Za-z_$][\w$]*),\4,([A-Za-z_$][\w$]*)\.locoEnv,this\.traits\)/;
const AFTER_STEP_PATTERN =
  /([A-Za-z_$][\w$]*)\|\|([A-Za-z_$][\w$]*)\.quest\.afterStep\(this\.state,this\.prev,([A-Za-z_$][\w$]*)\)\}([A-Za-z_$][\w$]*)\.onfoot\.update/;
const WALL_COLLISION_PATTERN =
  /,([A-Za-z_$][\w$]*)\.collideHorse\(([A-Za-z_$][\w$]*)\.x,\2\.z,([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\)\)\{/;
const WORLD_MOVE_PATTERN =
  /(?<header>move:\((?<x>[A-Za-z_$][\w$]*),(?<z>[A-Za-z_$][\w$]*),(?<heading>[A-Za-z_$][\w$]*),(?<nextX>[A-Za-z_$][\w$]*),(?<nextZ>[A-Za-z_$][\w$]*)\)=>\{)let (?<jump>[A-Za-z_$][\w$]*)=qe\(\)\?null:this\.jumping\?\.move\(\k<x>,\k<z>,\k<nextX>,\k<nextZ>\),(?<moveResult>[A-Za-z_$][\w$]*)=we\.move\(\k<x>,\k<z>,\k<heading>,\k<jump>\?\.x\?\?\k<nextX>,\k<jump>\?\.z\?\?\k<nextZ>\);/;

export function patchBundle(source) {
  const physicsMatch = source.match(PHYSICS_PATTERN);
  const playerStepMatch = source.match(PLAYER_STEP_PATTERN);
  const afterStepMatch = source.match(AFTER_STEP_PATTERN);
  const wallCollisionMatch = source.match(WALL_COLLISION_PATTERN);
  const worldMoveMatch = source.match(WORLD_MOVE_PATTERN);

  if (!physicsMatch || !playerStepMatch || !afterStepMatch || !wallCollisionMatch || !worldMoveMatch) {
    return { ok: false, source, reason: "Game bundle anchors changed" };
  }

  const [, stepName, footMode, stepWorld, delta, input, world] = playerStepMatch;
  const [, afterFootMode, afterWorld, afterDelta, afterWorldAgain] = afterStepMatch;
  const [, collisionObject, position, heading, output] = wallCollisionMatch;
  const {
    header: worldMoveHeader,
    x: moveX,
    z: moveZ,
    nextX,
    nextZ,
    heading: moveHeading,
    jump: jumpMove,
    moveResult
  } = worldMoveMatch.groups;

  const physicsHook =
    physicsMatch[0] +
    "if(e===window.__BT_PLAYER_STATE__){" +
    "window.__BT_CHEAT_STATE__=e;window.__BT_CHEAT_TRAITS__=i;window.__BT_PLAYER_INPUT__=t;" +
    "window.__BT_BASE_TRAITS__=window.__BT_BASE_TRAITS__||{speed:i.speed,stamina:i.stamina};" +
    "if(window.__BT_CHEAT__&&window.__BT_CHEAT__.enabled){" +
    "if(Number.isFinite(window.__BT_CHEAT__.speedMultiplier))i.speed=window.__BT_CHEAT__.speedMultiplier;else i.speed=window.__BT_BASE_TRAITS__.speed;" +
    "if(Number.isFinite(window.__BT_CHEAT__.staminaDrain))i.stamina=window.__BT_CHEAT__.staminaDrain;else i.stamina=window.__BT_BASE_TRAITS__.stamina;" +
    "if(Number.isFinite(window.__BT_CHEAT__.stamina))e.stamina=Math.max(0,Math.min(100,window.__BT_CHEAT__.stamina));" +
    "if(window.__BT_CHEAT__.staminaDrain===0)e.winded=false;" +
    "if(window.__BT_CHEAT__.forceGallop){e.requested='gallop';e.gallopLatch=false;t.gallopHeld=true;}" +
    "}else{i.speed=window.__BT_BASE_TRAITS__.speed;i.stamina=window.__BT_BASE_TRAITS__.stamina;}" +
    "}";

  const playerStepHook =
    `${stepName}((window.__BT_GAME__=this,` +
    "window.__BT_PLAYER_STATE__=this.state," +
    "window.__BT_GAME_TRAITS__=this.traits," +
    `window.__BT_PLAYER_INPUT__=${footMode}?${stepWorld}.onfoot.horseIntent(this.state,${delta}):${input},` +
    "window.__BT_PLAYER_STATE__),window.__BT_PLAYER_INPUT__," +
    `${delta},${world}.locoEnv,window.__BT_GAME_TRAITS__)`;

  const afterStepHook =
    `${afterFootMode}||${afterWorld}.quest.afterStep(this.state,this.prev,${afterDelta});` +
    "if(window.__BT_CHEAT__&&window.__BT_CHEAT__.enabled){" +
    "window.__BT_GAME__=this;window.__BT_PLAYER_STATE__=this.state;window.__BT_GAME_TRAITS__=this.traits;" +
    "if(Number.isFinite(window.__BT_CHEAT__.speedMultiplier))this.traits.speed=window.__BT_CHEAT__.speedMultiplier;else if(window.__BT_BASE_TRAITS__)this.traits.speed=window.__BT_BASE_TRAITS__.speed;" +
    "if(Number.isFinite(window.__BT_CHEAT__.staminaDrain))this.traits.stamina=window.__BT_CHEAT__.staminaDrain;else if(window.__BT_BASE_TRAITS__)this.traits.stamina=window.__BT_BASE_TRAITS__.stamina;" +
    "if(Number.isFinite(window.__BT_CHEAT__.stamina))this.state.stamina=Math.max(0,Math.min(100,window.__BT_CHEAT__.stamina));" +
    "if(window.__BT_CHEAT__.staminaDrain===0)this.state.winded=false;" +
    "if(window.__BT_CHEAT__.forceGallop){this.state.requested='gallop';this.state.gallopLatch=false;}" +
    "if(Number.isFinite(window.__BT_CHEAT__.speedNow)&&window.__BT_CHEAT__.speedNow>0)this.state.speed=window.__BT_CHEAT__.speedNow;" +
    `if(window.__BT_CHEAT__.fly)this.state.y=${afterWorldAgain}.locoEnv.groundAt(this.state.x,this.state.z)+(Number.isFinite(window.__BT_CHEAT__.flyHeight)?window.__BT_CHEAT__.flyHeight:12);` +
    `}else if(window.__BT_BASE_TRAITS__){this.traits.speed=window.__BT_BASE_TRAITS__.speed;this.traits.stamina=window.__BT_BASE_TRAITS__.stamina;}}${afterWorldAgain}.onfoot.update`;

  const wallCollisionHook =
    `,!((window.__BT_CHEAT__&&window.__BT_CHEAT__.noclip))&&${collisionObject}.collideHorse(${position}.x,${position}.z,${heading},${output})){`;

  const worldMoveHook =
    `${worldMoveHeader}let ${jumpMove}=qe()?null:this.jumping?.move(${moveX},${moveZ},${nextX},${nextZ});` +
    `if(window.__BT_CHEAT__?.enabled&&window.__BT_CHEAT__?.noclip)return{x:${jumpMove}?.x??${nextX},z:${jumpMove}?.z??${nextZ},heading:${moveHeading},contact:!!${jumpMove}};` +
    `let ${moveResult}=we.move(${moveX},${moveZ},${moveHeading},${jumpMove}?.x??${nextX},${jumpMove}?.z??${nextZ});`;

  let patched = source.replace(WORLD_MOVE_PATTERN, worldMoveHook)
    .replace(wallCollisionMatch[0], wallCollisionHook)
    .replace(physicsMatch[0], physicsHook)
    .replace(playerStepMatch[0], playerStepHook)
    .replace(afterStepMatch[0], afterStepHook);

  patched += "\n;window.__BT_HOOKS_READY__=true;\n";
  return { ok: true, source: patched };
}
