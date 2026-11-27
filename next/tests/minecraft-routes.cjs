// Sample complete CSS routes against real content/composer bounds.
const assert = require('node:assert/strict');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { chromium } = require('playwright');
const path = require('node:path');

async function run(browser) {
  const theme = JSON.parse(await readFile(path.join(__dirname, '../public/downloads/blockworks.json'), 'utf8'));
  const output = path.join(__dirname, '../local-docs/blockworks/verification');
  await mkdir(output, { recursive: true });
  const page = await browser.newPage();
  const results = [];
  for (const [width, height] of [[1600, 1050], [1000, 700], [640, 600], [320, 500], [1200, 400]]) {
    await page.setViewportSize({ width, height });
    for (const active of [false, true]) {
      for (const provider of ['OpenAI', 'Claude', 'Gemini', 'OpenCode']) {
        await page.setContent(`<!doctype html><html class="dark"><style>
          *{box-sizing:border-box}body{margin:0;background:#101010;color:#eee;font:14px system-ui}
          [data-chat-canvas]{position:relative;width:100vw;height:100vh}
          [data-workspace-area=conversation],[data-assistant-citation-viewport]{width:100%;height:100%}
          [data-assistant-citation-viewport]{display:flex;flex-direction:column}
          .messages-timeline-scroll{width:min(880px,84%);margin-inline:auto;overflow:auto;flex:1;min-height:0;padding:8px 0 140px}
          [data-timeline-row-kind]{padding:14px;margin-bottom:18px;background:#202020;min-height:80px}
          [data-workspace-area=composer]{position:absolute;left:50%;width:min(880px,77%);transform:translateX(-50%);${active ? 'bottom:16px' : 'top:44%'}}
          [data-chat-composer-main-surface]{height:100px;background:#252320;padding:16px;border:1px solid #444}
          ${theme.css}
          </style><div data-chat-canvas><div data-workspace-area="conversation"><div data-assistant-citation-viewport>
          ${active ? '<div class="messages-timeline-scroll">' + Array.from({length:15}, () => '<div data-timeline-row-kind="assistant">The conversation stays readable while the mobs wander.</div>').join('') + '</div>' : ''}
          </div></div><div data-workspace-area="composer"><div data-chat-composer-main-surface>Ask anything… <span data-chat-provider-model-picker aria-label="${provider}">${provider}</span></div></div></div>`);
        // Decode every embedded asset before visual checks.
        await page.evaluate(async () => {
          const root = getComputedStyle(document.documentElement);
          for (const key of ['openai','claude','gemini','opencode','portal','mist']) {
            const image = new Image(); image.src = root.getPropertyValue('--mc-'+key).trim().slice(5,-2); await image.decode();
          }
        });
        const result = await page.locator('[data-workspace-area=conversation]').evaluate((el, { active, provider }) => {
          const style = () => getComputedStyle(el, '::before');
          style().animationName;
          const route = el.getAnimations({subtree:true}).find(a => a.animationName !== 't3-minecraft-feet');
          route.pause(); const duration = route.effect.getTiming().duration;
          const composer = document.querySelector('[data-chat-composer-main-surface]').getBoundingClientRect();
          const scroll = document.querySelector('.messages-timeline-scroll');
          const reading = scroll?.getBoundingClientRect();
          const origin = el.getBoundingClientRect();
          let collisions=0, outOfBounds=0, rightVisits=0, mist=0; const xs=[],ys=[];
          for (let step=0;step<1200;step++) {
            route.currentTime=duration*step/1200;
            const s=style(),m=new DOMMatrixReadOnly(s.transform), size=parseFloat(s.width);
            // scaleX(-1) mirrors around the default center, preserving its bounds.
            const x=origin.x+m.m41,y=origin.y+m.m42;
            xs.push(x);ys.push(y);
            const hit=r=>x<r.right && x+size>r.left && y<r.bottom && y+size>r.top;
            if(hit(composer) || (reading && hit(reading))) collisions++;
            if(x < -.5 || y < -.5 || x+size>origin.right+.5 || y+size>origin.bottom+.5)outOfBounds++;
            if(active && x>origin.width/2)rightVisits++;
            if(s.backgroundImage.includes(getComputedStyle(document.documentElement).getPropertyValue('--mc-mist').trim()))mist++;
          }
          return {active,provider,width:origin.width,height:origin.height,collisions,outOfBounds,rightVisits,mist,xRange:Math.max(...xs)-Math.min(...xs),yRange:Math.max(...ys)-Math.min(...ys)};
        }, { active, provider });
        results.push(result);
        assert.equal(result.collisions, 0, 'Content collision: '+JSON.stringify(result));
        assert.equal(result.outOfBounds, 0, 'Clipped actor: '+JSON.stringify(result));
        if (provider === 'Gemini') {
          assert.ok(result.xRange > width*.7 && result.yRange > height*.6, 'Allay must fly around the page: '+JSON.stringify(result));
        } else if (active && provider !== 'OpenCode') {
          assert.equal(result.rightVisits, 0, 'Ground mobs must stay left during a conversation');
          assert.ok(result.yRange > 10, 'Ground mobs need vertical space');
        } else if (provider === 'OpenCode') {
          assert.ok(result.mist > 0, 'Teleport must leave purple particles');
          if (active) assert.ok(result.rightVisits > 0 && result.rightVisits < 60, 'Right-side visits must be rare');
        } else {
          assert.ok(result.xRange > width*.35, 'New-thread mobs should traverse free space');
        }
        if (width === 1600 && provider === 'OpenAI') await page.screenshot({path:path.join(output,active?'native-active.png':'native-new.png')});
      }
    }
  }
  // Four tall mobs are the worst case for the vertical lanes. Child slots must
  // remain visible too, even when every provider produces an enderman.
  await page.locator('[data-assistant-citation-viewport]').evaluate(el => {
    const group=document.createElement('div');group.dataset.subagentGroup='';
    group.innerHTML='<button aria-expanded="true">3 working</button><div data-slot="collapsible-panel" hidden>'+Array.from({length:3},()=>'<div data-v2-item-type="subagent" aria-description="Running"><span data-provider-kind="opencode"></span></div>').join('')+'</div>';
    el.append(group);
  });
  const crowded = await page.locator('[data-workspace-area=conversation]').evaluate(el => {
    const child=el.querySelector('[data-assistant-citation-viewport]');
    const slots=[[el,'::before'],[el,'::after'],[child,'::before'],[child,'::after']];
    slots.forEach(([host,pseudo])=>getComputedStyle(host,pseudo).content);
    const animations=el.getAnimations({subtree:true});animations.forEach(a=>a.pause());
    let clipped=0,overlap=0;
    for(let step=0;step<1200;step++) {
      animations.forEach(a=>a.currentTime=a.effect.getTiming().duration*step/1200);
      const boxes=slots.map(([host,pseudo])=>{const s=getComputedStyle(host,pseudo),m=new DOMMatrixReadOnly(s.transform);return{x:m.m41,y:m.m42,w:parseFloat(s.width),h:parseFloat(s.height)}});
      for(const r of boxes)if(r.y<-.5 || r.y+r.h>el.clientHeight+.5)clipped++;
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
        const a=boxes[i],b=boxes[j];
        if(a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y)overlap++;
      }
    }
    return{clipped,overlap,count:slots.filter(([h,p])=>getComputedStyle(h,p).content!=='none').length};
  });
  assert.equal(crowded.count,4);
  assert.equal(crowded.clipped,0,'Child mobs must stay within the canvas');
  assert.equal(crowded.overlap,0,'Ground mob lanes must not crowd each other');
  await writeFile(path.join(output, 'routes.json'), JSON.stringify(results,null,2)+'\n');
  await page.close();
  console.log(`Minecraft route checks passed: ${results.length} provider/state/viewport combinations, 1,200 samples each.`);
}
module.exports = run;
if (require.main === module) (async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});try{await run(browser)}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
