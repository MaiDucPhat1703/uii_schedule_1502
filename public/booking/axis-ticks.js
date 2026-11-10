// Reserve space for the endpoint labels, then keep only hourly ticks that fit.
export function axisTicks(open,close,width){
 if(close<=open)return [open];
 const label=36,gap=12,w=Math.max(72,width||320),out=[open],endLeft=w-label;
 let right=label;
 for(let minute=open+60;minute<close;minute+=60){
  const x=(minute-open)/(close-open)*w,left=x-label/2;
  if(left>=right+gap&&left+label+gap<=endLeft){out.push(minute);right=left+label;}
 }
 out.push(close);return out;
}
