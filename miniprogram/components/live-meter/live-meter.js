Component({
 properties:{calibrated:{type:Boolean,value:false}},
 data:{running:true,load:60,power:'1380'},
 lifetimes:{ready(){this.alive=true;this.visible=true;this.init();},detached(){this.alive=false;this.stop();this.canvas=null;}},
 pageLifetimes:{show(){this.visible=true;this.start();},hide(){this.visible=false;this.stop();},resize(){this.init();}},
 methods:{
  changeLoad(e){const load=Math.max(20,Math.min(100,Number(e.detail.value)||20));this.setData({load,power:this.data.running?String(load*23):'0000'});this.draw();},
  toggle(){const running=!this.data.running;this.setData({running,power:running?String(this.data.load*23):'0000'});if(running)this.start();else{this.stop();this.draw();}},
  stop(){if(this.frame!=null&&this.canvas)this.canvas.cancelAnimationFrame(this.frame);this.frame=null;},
  start(){this.stop();if(!this.canvas||!this.alive||!this.visible||!this.data.running)return;const tick=()=>{if(!this.alive||!this.visible||!this.data.running)return;const now=Date.now();if(!this.last||now-this.last>=32){this.phase=now/350;this.draw();this.last=now;}this.frame=this.canvas.requestAnimationFrame(tick);};tick();},
  init(){this.stop();this.createSelectorQuery().select('#wave').fields({node:true,size:true}).exec(result=>{if(!this.alive||!result[0]||!result[0].node)return;const {node,width,height}=result[0];const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();this.canvas=node;this.w=width;this.h=height;node.width=width*info.pixelRatio;node.height=height*info.pixelRatio;this.ctx=node.getContext('2d');this.ctx.scale(info.pixelRatio,info.pixelRatio);this.draw();this.start();});},
  draw(){if(!this.ctx)return;const c=this.ctx,w=this.w,h=this.h;c.clearRect(0,0,w,h);c.strokeStyle='#deeff8';c.lineWidth=1;for(let x=0;x<w;x+=22){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();c.strokeStyle=this.data.calibrated?'#249dde':'#66bde9';c.lineWidth=2;c.beginPath();for(let x=0;x<=w;x+=2){const y=h/2+(this.data.running?Math.sin(x/w*Math.PI*5-(this.phase||0))*h*.38*this.data.load/100:0);if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
 }
});