export function minuteAt(clientX,left,width,policy){const value=policy.openMinute+(clientX-left)/Math.max(1,width)*(policy.closeMinute-policy.openMinute);return Math.max(policy.openMinute,Math.min(policy.closeMinute,Math.round(value/policy.stepMinutes)*policy.stepMinutes));}
export function draggedRange(anchor,point,policy){return {start:Math.min(anchor,point),end:Math.max(anchor,point)};}
