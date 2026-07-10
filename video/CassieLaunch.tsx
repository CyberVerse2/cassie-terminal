import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {bg:'#090a0c', panel:'#101217', ivory:'#e7e6e2', gold:'#d8b87e', green:'#52c489', blue:'#4d9feb', coral:'#e87970'};
const sans = 'Inter, ui-sans-serif, system-ui, sans-serif';
const mono = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace';
const clamp = {extrapolateLeft:'clamp' as const, extrapolateRight:'clamp' as const};

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const dots = Array.from({length:90}, (_,i) => {
    const x = (i * 83 + (f % 2) * 7) % 1920;
    const y = (i * 47 + (f % 2) * 11) % 1080;
    return <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.2 : .55} fill={C.ivory} opacity={.035 + (i%4)*.008}/>;
  });
  return <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>{dots}</svg>;
};

const Grid: React.FC<{opacity?:number}> = ({opacity=.16}) => <div style={{position:'absolute',inset:0,opacity,backgroundImage:`linear-gradient(${C.ivory}12 1px, transparent 1px),linear-gradient(90deg, ${C.ivory}12 1px, transparent 1px)`,backgroundSize:'80px 80px',maskImage:'radial-gradient(circle at center, black 0%, transparent 72%)'}}/>;

const Word: React.FC<{children:React.ReactNode; small?:boolean}> = ({children,small}) => <div style={{fontFamily:sans,fontWeight:600,fontSize:small?20:74,letterSpacing:small?'0.18em':'-0.055em',textTransform:small?'uppercase':'none',color:C.ivory}}>{children}</div>;

const SignalNoise: React.FC = () => {
  const f = useCurrentFrame();
  const {fps}=useVideoConfig();
  const intro=spring({frame:f,fps,config:{damping:18}});
  const rush=interpolate(f,[90,300],[0,1],clamp);
  const items=['BTC · 67,420','LONG / PERP','ETH +2.8%','FED 4.25','SOL · 182.4','MARKETS','ENTRY 66,900','Δ +4.12','TOKENIZED','HORIZON 4D','STOP 64,800','SOURCE'];
  return <AbsoluteFill style={{background:C.bg,overflow:'hidden'}}><Grid opacity={.12}/>
    {items.map((t,i)=>{const a=i*0.52+f*.004*(i%2?1:-1);const radius=220+(i%4)*115+rush*180;const x=960+Math.cos(a)*radius;const y=540+Math.sin(a*1.25)*radius*.52;return <div key={t} style={{position:'absolute',left:x,top:y,transform:`translate(-50%,-50%) scale(${.9+intro*.1})`,fontFamily:mono,fontSize:18+(i%3)*5,color:i%5===0?C.gold:C.ivory,opacity:intro*(.25+(i%4)*.13),border:`1px solid ${C.ivory}20`,padding:'12px 18px',background:`${C.panel}cc`,whiteSpace:'nowrap'}}>{t}</div>})}
    <div style={{position:'absolute',left:130,top:140,opacity:interpolate(f,[8,38],[0,1],clamp)}}><Word>The market never</Word><Word>stops talking.</Word></div>
    <div style={{position:'absolute',left:130,bottom:110,opacity:interpolate(f,[118,145,268,295],[0,1,1,0],clamp)}}><Word>But a signal</Word><Word>isn’t a decision.</Word></div><Grain/></AbsoluteFill>;
};

const Organize: React.FC = () => {
 const f=useCurrentFrame(); const {fps}=useVideoConfig(); const settle=spring({frame:f-15,fps,config:{damping:17,stiffness:80}}); const line=interpolate(f,[0,90],[0,100],clamp);
 return <AbsoluteFill style={{background:C.bg,overflow:'hidden'}}><Grid opacity={interpolate(f,[0,80],[.08,.28],clamp)}/>
   <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}}><defs><linearGradient id="gold"><stop stopColor={C.gold} stopOpacity="0"/><stop offset=".5" stopColor={C.gold}/><stop offset="1" stopColor={C.gold} stopOpacity="0"/></linearGradient></defs><path d="M -100 540 C 360 540 420 220 820 330 S 1360 760 2020 540" fill="none" stroke="url(#gold)" strokeWidth="2" strokeDasharray="1900" strokeDashoffset={1900-line*19}/></svg>
   <div style={{position:'absolute',left:140,top:150,opacity:settle,transform:`translateY(${(1-settle)*40}px)`}}><div style={{fontFamily:mono,color:C.gold,fontSize:18,letterSpacing:5,marginBottom:22}}>INTRODUCING</div><Word>Meet cassie.</Word><div style={{fontFamily:sans,color:C.ivory,opacity:.65,fontSize:28,marginTop:18}}>Market signal, made decision-ready.</div></div>
   {[0,1,2].map(i=><div key={i} style={{position:'absolute',right:150+i*82,top:250+i*145,width:320,height:1,background:C.gold,opacity:settle*(.7-i*.16),transform:`rotate(${-18+i*8}deg) scaleX(${settle})`,transformOrigin:'right'}}/>)}<Grain/></AbsoluteFill>;
};

const ProductFrame: React.FC<{src:string; label:string; zoom?:number}> = ({src,label,zoom=1}) => {
 const f=useCurrentFrame(); const {fps}=useVideoConfig(); const enter=spring({frame:f,fps,config:{damping:20,stiffness:90}}); const drift=interpolate(f,[0,240],[0,1],clamp);
 return <AbsoluteFill style={{background:C.bg,overflow:'hidden'}}><Grid opacity={.12}/>
   <div style={{position:'absolute',left:96,top:70,fontFamily:mono,color:C.gold,fontSize:18,letterSpacing:5}}>{label}</div>
   <div style={{position:'absolute',left:96,right:96,top:122,bottom:72,border:`1px solid ${C.gold}66`,background:C.panel,overflow:'hidden',boxShadow:`0 36px 120px #000` ,opacity:enter,transform:`perspective(1600px) rotateX(${(1-enter)*7}deg) translateY(${(1-enter)*55}px)`}}><Img src={staticFile(src)} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',transform:`scale(${zoom+drift*.035}) translateX(${-drift*10}px)`}}/><div style={{position:'absolute',inset:0,boxShadow:'inset 0 0 120px 18px #090a0c'}}/></div><Grain/></AbsoluteFill>;
};

const Thesis: React.FC = () => {
 const f=useCurrentFrame(); const reveal=(n:number)=>spring({frame:f-n*22,fps:30,config:{damping:20}}); const rows=[['THESIS','Momentum has held above reclaimed structure.'],['01 · CATALYST','Venue flows confirm sustained demand.'],['02 · STRUCTURE','Higher lows compress beneath resistance.'],['03 · RISK','Invalidation remains explicit and nearby.']];
 return <AbsoluteFill style={{background:C.bg,padding:'105px 130px'}}><Grid opacity={.11}/><div style={{fontFamily:mono,color:C.gold,fontSize:18,letterSpacing:5,marginBottom:45}}>ONE COHERENT TRADE BRIEF</div>{rows.map((r,i)=><div key={r[0]} style={{display:'grid',gridTemplateColumns:'300px 1fr',alignItems:'center',height:145,borderTop:`1px solid ${C.ivory}24`,opacity:reveal(i),transform:`translateX(${(1-reveal(i))*45}px)`}}><div style={{fontFamily:mono,fontSize:18,color:i?C.gold:C.ivory}}>{r[0]}</div><div style={{fontFamily:sans,fontSize:i?32:46,fontWeight:i?450:600,color:C.ivory,letterSpacing:'-.03em'}}>{r[1]}</div></div>)}<Grain/></AbsoluteFill>;
};

const Plan: React.FC = () => {const f=useCurrentFrame(); const p=interpolate(f,[20,150],[0,1],clamp); const values=[['ENTRY','$66,900'],['TARGET','$72,400'],['STOP','$64,800'],['HORIZON','4 DAYS']];return <AbsoluteFill style={{background:C.bg,padding:'125px 130px'}}><div style={{fontFamily:mono,color:C.gold,fontSize:18,letterSpacing:5}}>TRADE PLAN</div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:2,marginTop:72}}>{values.map((v,i)=><div key={v[0]} style={{background:C.panel,border:`1px solid ${C.ivory}20`,padding:'34px 30px',opacity:interpolate(p,[i*.15,i*.15+.35],[0,1],clamp),transform:`translateY(${interpolate(p,[i*.15,i*.15+.35],[35,0],clamp)}px)`}}><div style={{fontFamily:mono,fontSize:17,color:C.ivory,opacity:.48,letterSpacing:2}}>{v[0]}</div><div style={{fontFamily:mono,fontSize:37,color:i===1?C.green:i===2?C.coral:C.ivory,marginTop:20}}>{v[1]}</div></div>)}</div><div style={{marginTop:82,height:3,background:`${C.ivory}1c`}}><div style={{width:`${p*100}%`,height:'100%',background:C.gold}}/></div><div style={{fontFamily:sans,color:C.ivory,fontSize:50,fontWeight:600,letterSpacing:'-.04em',marginTop:72}}>Judge the idea. Decide how to express it.</div><Grain/></AbsoluteFill>};

const EndCard: React.FC = () => {const f=useCurrentFrame();const {fps}=useVideoConfig();const s=spring({frame:f-8,fps,config:{damping:16,stiffness:70}});return <AbsoluteFill style={{background:C.bg,justifyContent:'center',alignItems:'center'}}><Grid opacity={.14}/><div style={{transform:`scale(${.9+s*.1})`,opacity:s,textAlign:'center'}}><div style={{fontFamily:sans,fontWeight:650,fontSize:150,letterSpacing:'-.075em',color:C.ivory}}>cassie<span style={{color:C.green,fontSize:56,verticalAlign:'top'}}>●</span></div><div style={{height:1,width:520,background:C.gold,margin:'35px auto'}}/><div style={{fontFamily:mono,color:C.ivory,opacity:.72,fontSize:22,letterSpacing:4}}>FROM MARKET SIGNAL TO DECISION</div></div><Grain/></AbsoluteFill>};

const Launch: React.FC = () => <AbsoluteFill style={{background:C.bg}}><Audio src={staticFile('video/soundtrack.wav')}/><Sequence from={0} durationInFrames={300}><SignalNoise/></Sequence><Sequence from={300} durationInFrames={180}><Organize/></Sequence><Sequence from={480} durationInFrames={240}><ProductFrame src="video/desk.png" label="THE DESK · PERPS / STOCKS / TOKENS / MARKETS" zoom={1.03}/></Sequence><Sequence from={720} durationInFrames={240}><ProductFrame src="video/trade.png" label="SOURCE · LIVE MARKET · PERFORMANCE" zoom={1.02}/></Sequence><Sequence from={960} durationInFrames={240}><Thesis/></Sequence><Sequence from={1200} durationInFrames={210}><Plan/></Sequence><Sequence from={1410} durationInFrames={90}><EndCard/></Sequence></AbsoluteFill>;

export const Root:React.FC=()=> <Composition id="CassieLaunch" component={Launch} durationInFrames={1500} fps={30} width={1920} height={1080}/>;
