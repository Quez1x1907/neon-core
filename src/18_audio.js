/* ==================== Звук: синтез через Web Audio, без файлов ==================== */
const AudioSys = {
  ctx:null, master:null, noiseBuf:null, last:{},
  init(){
    if (this.ctx) return;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = S.sound ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate*0.6);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    }catch(e){ this.ctx = null; }
  },
  resume(){ this.init(); if (this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
  setMuted(m){ if (this.master) this.master.gain.value = m ? 0 : 0.5; },
  tone(freq, dur, type, vol, slideTo, delay){
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (delay||0);
    if (!isFinite(t0) || !isFinite(freq) || freq <= 0) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type||'square'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo), t0+dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol||0.15, t0+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0+dur+0.02);
  },
  noise(dur, vol, f0, f1, delay, type){
    if (!this.ctx || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + (delay||0);
    if (!isFinite(t0)) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type||'lowpass';
    f.frequency.setValueAtTime(f0||1000, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(40,f1), t0+dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol||0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0+dur+0.02);
  },
  /* name — событие; троттлинг не даёт одинаковым звукам захлёбываться.
     Любой сбой WebAudio (прерывание на iOS и т.п.) глушит движок, но не игру */
  play(name){
    if (!this.ctx || !S.sound) return;
    try{
      this._play(name);
    }catch(e){
      try{ this.ctx.close(); }catch(e2){}
      this.ctx = null;
    }
  },
  _play(name){
    if (!this.ctx || !S.sound) return;
    const now = this.ctx.currentTime;
    const gaps = { pulse:0.055, tesla:0.09, boom:0.07, beamtick:0.1, click:0.03, coin:0.09, hit:0.05, snipe:0.06 };
    if (gaps[name] !== undefined && this.last[name] !== undefined && now - this.last[name] < gaps[name]) return;
    this.last[name] = now;
    switch(name){
      case 'click':   this.tone(700,0.06,'square',0.08,420); break;
      case 'place':   this.tone(220,0.1,'sine',0.22,560); this.tone(440,0.08,'sine',0.12,880,0.05); break;
      case 'upgrade': this.tone(520,0.08,'square',0.12); this.tone(660,0.08,'square',0.12,undefined,0.07); this.tone(880,0.12,'square',0.12,undefined,0.14); break;
      case 'sell':    this.tone(600,0.14,'sine',0.16,240); break;
      case 'error':   this.tone(160,0.12,'sawtooth',0.14,110); break;
      case 'pulse':   this.tone(880+rnd(-60,60),0.045,'square',0.05,500); break;
      case 'snipe':   this.noise(0.09,0.2,3200,500); this.tone(180,0.08,'sine',0.18,60); break;
      case 'missile': this.noise(0.22,0.12,600,2600,0,'bandpass'); break;
      case 'boom':    this.noise(0.3,0.3,1400,90); this.tone(90,0.25,'sine',0.3,40); break;
      case 'tesla':   this.tone(1400,0.07,'sawtooth',0.09,300); this.noise(0.06,0.1,4000,1500,0,'highpass'); break;
      case 'beamtick':this.tone(1150+rnd(-80,80),0.05,'sawtooth',0.035,1000); break;
      case 'toxin':   this.tone(180+rnd(-30,30),0.07,'sine',0.05,340); break;
      case 'coin':    this.tone(980,0.06,'sine',0.1); this.tone(1320,0.09,'sine',0.1,undefined,0.05); break;
      case 'hit':     this.tone(300,0.04,'triangle',0.06,220); break;
      case 'leak':    this.tone(320,0.16,'square',0.2,180); this.tone(220,0.2,'square',0.2,120,0.12); break;
      case 'heal':    this.tone(600,0.1,'sine',0.05,900); break;
      case 'wavestart': this.tone(330,0.12,'square',0.1,440); this.tone(440,0.14,'square',0.1,660,0.1); break;
      case 'boss':    this.tone(70,0.5,'sawtooth',0.3,55); this.tone(140,0.5,'square',0.14,100,0.05); this.noise(0.5,0.1,300,80); break;
      case 'emp':     this.tone(900,0.25,'sawtooth',0.14,80); this.noise(0.25,0.16,2500,150); break;
      case 'over':    this.tone(280,0.5,'sawtooth',0.16,980); this.tone(560,0.4,'square',0.08,1400,0.08); break;
      case 'nova':    this.tone(50,0.7,'sawtooth',0.3,240); this.noise(0.6,0.28,900,60); this.tone(440,0.3,'sine',0.12,880,0.1); break;
      case 'win':     [523,659,784,1047].forEach((f,i)=>this.tone(f,0.16,'square',0.12,undefined,i*0.11)); break;
      case 'lose':    [392,330,262,196].forEach((f,i)=>this.tone(f,0.22,'sawtooth',0.12,undefined,i*0.16)); break;
      case 'ach':     [784,988,1175,1568].forEach((f,i)=>this.tone(f,0.1,'sine',0.1,undefined,i*0.07)); break;
    }
  },
};
