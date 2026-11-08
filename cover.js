/* SPC Photo Movie Maker — SNSカバー画像（ローカル処理） */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const canvas = $("cover-canvas");
  if (!canvas) return;
  const status = $("cover-status"), download = $("cover-download");
  const sizes = {"16x9": [1920,1080], "9x16": [1080,1920], "1x1": [1080,1080]};
  const selectedSize = () => document.querySelector('[name="size"]:checked')?.value || "9x16";
  const sourceIsVideo = () => document.querySelector('[name="cover-source"]:checked')?.value === "frame";
  let request = 0;
  let renderedUrl = "";
  let renderedSize = "";

  function waitFor(media, type, ms = 12000) {
    return new Promise((resolve,reject) => {
      const clean = () => {clearTimeout(timer);media.removeEventListener(type,onReady);media.removeEventListener("error",onError);};
      const onReady = () => {clean();resolve();};
      const onError = () => {clean();reject(new Error("完成動画から画像を読み取れませんでした。"));};
      const timer = setTimeout(onError,ms);
      media.addEventListener(type,onReady,{once:true});
      media.addEventListener("error",onError,{once:true});
    });
  }
  async function readFrame(url, time) {
    const player = document.createElement("video");
    player.muted = true;player.playsInline = true;player.preload = "auto";
    player.src = url;
    try {
      await waitFor(player,"loadedmetadata");
      const t = Math.max(.04,Math.min(time,Math.max(.04,player.duration-.1)));
      const seeking = waitFor(player,"seeked");
      player.currentTime = t;
      await seeking;
      if (player.readyState < 2) await waitFor(player,"loadeddata");
      return await createImageBitmap(player);
    } finally {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
  }
  function drawSource(ctx,image,width,height,cropMode) {
    const iw = image.width, ih = image.height;
    if (!iw || !ih) throw new Error("表紙の画像サイズを確認できません。");
    const contain = cropMode === "contain";
    const scale = (contain ? Math.min : Math.max)(width/iw,height/ih);
    const w = iw*scale,h=ih*scale;
    ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
  }
  function drawText(ctx,text,width,height) {
    if (!text.trim()) return;
    const fontSize = Math.round(Math.min(width,height)*.067);
    ctx.font = 'bold '+fontSize+'px "Yu Gothic UI",Meiryo,sans-serif';
    const maxWidth=width*.84;
    const lines=[];
    for (const raw of text.trim().split("\n")) {
      let line="";
      for (const ch of raw) {
        if(line && ctx.measureText(line+ch).width>maxWidth){lines.push(line);line=ch;}
        else line+=ch;
      }
      if(line)lines.push(line);
    }
    const rows=lines.slice(0,6);
    const lh=fontSize*1.35;
    const top=(height-rows.length*lh)/2;
    ctx.fillStyle="rgba(0,0,35,.58)";
    ctx.fillRect(0,Math.max(0,top-fontSize*.5),width,rows.length*lh+fontSize);
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";
    ctx.shadowColor="#000b";ctx.shadowBlur=fontSize*.1;
    rows.forEach((line,i)=>ctx.fillText(line,width/2,top+(i+.5)*lh,maxWidth));
    ctx.shadowBlur=0;
  }
  async function refresh() {
    const id=++request, fromVideo=sourceIsVideo(), chosenSize=selectedSize();
    $("cover-frame-controls").hidden=!fromVideo;
    $("cover-image-controls").hidden=fromVideo;
    $("cover-time-value").value=Number($("cover-time").value).toFixed(1)+"秒";
    const [width,height]=sizes[chosenSize];
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#111427";ctx.fillRect(0,0,width,height);
    download.disabled=true;
    let image;
    try {
      if(fromVideo){
        const link=$("video").getAttribute("src");
        if(!link || !renderedUrl) {status.textContent="MP4を生成すると、好きな場面から表紙を選べます。";return;}
        if(chosenSize!==renderedSize){status.textContent="サイズ変更後は、このサイズでMP4を再生成してください。";return;}
        status.textContent="動画から表紙の場面を取得しています…";
        image=await readFrame(link,Number($("cover-time").value));
      } else {
        const file=$("cover-image").files[0];
        if(!file){status.textContent="表紙にする写真を選んでください。";return;}
        if(!/\.(png|webp|jpe?g)$/i.test(file.name)||file.size===0||file.size>20*1024*1024) {
          throw new Error("写真はJPG・PNG・WebP、20MB以内で指定してください。");
        }
        status.textContent="表紙写真を読み込んでいます…";
        image=await createImageBitmap(file,{imageOrientation:"from-image"});
      }
      if(id!==request)return;
      drawSource(ctx,image,width,height,fromVideo?"cover":$("cover-fit").value);
      drawText(ctx,$("cover-title").value,width,height);
      const logoFile=$("cover-logo").checked ? $("logo").files[0] : null;
      if(logoFile){
        const logo=await createImageBitmap(logoFile);
        try {
          if(id!==request)return;
          const w=width*.23,h=Math.min(height*.1,w*logo.height/logo.width);
          const bottom=document.querySelector("[name=logo_position]").value==="bottom";
          ctx.drawImage(logo,(width-w)/2,bottom?height-h-height*.05:height*.05,w,h);
        } finally {logo.close();}
      }
      if(id!==request)return;
      status.textContent="JPGを保存できます。SNSに投稿する際、表紙画像として設定してください。";
      download.disabled=false;
    }catch(error){
      if(id===request)status.textContent=error.message||"表紙を作成できませんでした。";
    }finally{image?.close?.();}
  }
  for(const input of document.querySelectorAll('[name="cover-source"]')){
    input.addEventListener("change",()=>void refresh());
  }
  $("cover-image").addEventListener("change",()=>void refresh());
  $("cover-fit").addEventListener("change",()=>void refresh());
  $("cover-time").addEventListener("input",()=>{$("cover-time-value").value=Number($("cover-time").value).toFixed(1)+"秒";});
  $("cover-time").addEventListener("change",()=>void refresh());
  let timer;
  $("cover-title").addEventListener("input",()=>{
    clearTimeout(timer);timer=setTimeout(()=>void refresh(),250);
  });
  $("cover-logo").addEventListener("change",()=>void refresh());
  $("logo").addEventListener("change",()=>{if($("cover-logo").checked)void refresh();});
  for(const input of document.querySelectorAll('[name="size"]')){
    input.addEventListener("change",()=>void refresh());
  }
  document.querySelector("[name=logo_position]").addEventListener("change",()=>{
    if($("cover-logo").checked)void refresh();
  });
  // 既存のレンダラーが完成MP4のsrcを設定したら表紙にも反映する。
  new MutationObserver(()=>{
    const url=$("video").getAttribute("src")||"";
    if(url===renderedUrl)return;
    renderedUrl=url;
    renderedSize=selectedSize();
    void refresh();
  }).observe($("video"),{attributes:true,attributeFilter:["src"]});
  download.addEventListener("click",async()=>{
    if(download.disabled)return;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.92));
    if(!blob){status.textContent="表紙の保存に失敗しました。";return;}
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="SPC_Video_Cover_"+selectedSize()+".jpg";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  });
  void refresh();
})();
