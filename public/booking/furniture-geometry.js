// Plan-view dimensions in metres, matching the seat and tabletop in studio/model.js.
export const HEX_RADIUS = 0.96;
export const CHAIR_BODY = Object.freeze({x:-0.225,y:-0.215,width:0.45,height:0.43,rx:0.065});
export const CHAIR_BACK_PATH = 'M -.22 -.25 Q 0 -.30 .22 -.25';
export const hexOutline = () => Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3)*HEX_RADIUS,Math.sin(i*Math.PI/3)*HEX_RADIUS]);
