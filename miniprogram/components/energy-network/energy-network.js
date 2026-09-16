Component({
 properties:{active:{type:Number,value:0,observer(){this.draw();}}},
 lifetimes:{ready(){this.alive=true;this.visible=true;this.init();},detached(){this.alive=false;this.stop();this.canvas=null;}},
 pageLifetimes:{show(){this.visible=true;this.start();},hide(){this.visible=false;this.stop();},resize(){this.init();}},
 methods:{
  stop(){if(this.frame!=null&&this.canvas)this.canvas.cancelAnimationFrame(this.frame);this.frame=null;},
  start(){this.stop();if(!this.canvas||!this.alive||!this.visible)return;const tick=()=>{if(!this.alive||!this.visible)return;const now=Date.now();if(!this.lastFrame||now-this.lastFrame>=32){this.phase=now/1300;this.draw();this.lastFrame=now;}this.frame=this.canvas.requestAnimationFrame(tick);};tick();},
  init(){this.stop();this.createSelectorQuery().select('#network').fields({node:true,size:true}).exec(res=>{
   if(!this.alive||!res[0]||!res[0].node)return;
   const {node,width,height}=res[0]; const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
   node.width=width*info.pixelRatio;node.height=height*info.pixelRatio;
   this.canvas=node;this.w=width;this.h=height;this.ctx=node.getContext('2d');this.ctx.scale(info.pixelRatio,info.pixelRatio);this.draw();this.start();
  });},
  draw(){if(!this.ctx||!this.canvas)return;const c=this.ctx,w=this.w,h=this.h;c.clearRect(0,0,w,h);
   c.strokeStyle='#d4eaf7';c.lineWidth=.6;for(let x=12;x<w;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=12;y<h;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
   const points=[[.17,.25],[.5,.15],[.83,.25],[.17,.72],[.5,.82],[.83,.72]],labels=['光伏','充电桩','数据中心','智慧工厂','楼宇','输配电'];
   points.forEach((p,i)=>{const x=w*p[0],y=h*p[1],lit=i<this.data.active;c.strokeStyle=lit?'#29a8e5':'#aecfe1';c.lineWidth=lit?2:1;c.beginPath();c.moveTo(w*.5,h*.48);c.lineTo(x,h*.48);c.lineTo(x,y);c.stroke();c.fillStyle=lit?'#29a8e5':'#bedbea';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();if(lit){const pulse=(Math.sin((this.phase||0)*3+i)+1)/2;c.strokeStyle='rgba(41,168,229,'+(0.15+pulse*.4)+')';c.beginPath();c.arc(x,y,8+pulse*9,0,Math.PI*2);c.stroke();const cx=w*.5,cy=h*.48,dx=x-cx,dy=y-cy,len=Math.abs(dx)+Math.abs(dy);for(let k=0;k<2;k++){const distance=(((this.phase||0)*.55+k*.5+i*.11)%1)*len;const px=distance<Math.abs(dx)?cx+Math.sign(dx)*distance:x;const py=distance<Math.abs(dx)?cy:cy+Math.sign(dy)*(distance-Math.abs(dx));c.fillStyle='#168ac6';c.beginPath();c.arc(px,py,2.5,0,Math.PI*2);c.fill();}}c.font='10px sans-serif';c.textAlign='center';c.fillStyle=lit?'#24668e':'#6f93a9';c.fillText(labels[i],x,y+23);});
   const halo=((this.phase||0)*.45)%1;c.strokeStyle='rgba(59,175,232,'+((1-halo)*.4)+')';c.lineWidth=1;c.beginPath();c.arc(w*.5,h*.48,33+halo*23,0,Math.PI*2);c.stroke();c.fillStyle='#ffffff';c.strokeStyle='#3bafe8';c.lineWidth=1.5;c.beginPath();c.arc(w*.5,h*.48,30,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#238fca';c.font='bold 16px monospace';c.textAlign='center';c.fillText('DH',w*.5,h*.48+6);
  }
 }
});
