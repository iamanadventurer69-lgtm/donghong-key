function direction(start,end){if(!start||!end)return 0;const dx=end.clientX-start.clientX,dy=end.clientY-start.clientY;return Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.5?(dx<0?1:-1):0;}
const methods={
 swipeStart(e){this.swipeOrigin=e.touches&&e.touches[0];},
 swipeEnd(e){const d=direction(this.swipeOrigin,e.changedTouches&&e.changedTouches[0]);this.swipeOrigin=null;if(d>0)this.nextPanel();if(d<0)this.prevPanel();},
 swipeCancel(){this.swipeOrigin=null;},
 holdGesture(){this.swipeOrigin=null;},
 nextPanel(){this.setData({panel:Math.min(this.data.panelCount-1,this.data.panel+1)});},
 prevPanel(){this.setData({panel:Math.max(0,this.data.panel-1)});}
};module.exports={direction,methods};
