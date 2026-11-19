(() => {
  const $=id=>document.getElementById(id);
  const n=value=>Number(value)||0;
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const eur=value=>new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(value||0);
  const yen=value=>`¥${new Intl.NumberFormat("en-IE",{maximumFractionDigits:0}).format(value||0)}`;
  const pair=(value,rate)=>`<span class="pair">${eur(value)}<small class="small">≈ ${yen(value*n(rate))}</small></span>`;
  const field=(data,label)=>data.vehicle?.find(item=>item.label===label)?.value||"";
  const carName=data=>field(data,"Model").split(",")[0].trim()||"Car details not added";
  const dateText=value=>value?new Intl.DateTimeFormat("en-IE",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T00:00:00`)):"Date not set";
  const photo=data=>field(data,"Singapore plate")==="SLG7315S"
    ?`<img class="photo" src="mazda-3-photo.jpg" alt="Black Mazda 3 with Singapore plate SLG7315S">`
    :`<div class="photo-placeholder">Add a car photo</div>`;
  const calculate=data=>{
    const invoice=data.invoice||{},vrt=data.vrt||{},rate=n(invoice.rate);
    const invoiceTotal=n(invoice.fob)+n(invoice.freight)+n(invoice.other)+n(invoice.insurance);
    const cif=rate>0?invoiceTotal/rate:0,duty=cif*n(invoice.dutyRate),vat=invoice.vatEnabled?(cif+duty)*0.23:0;
    const fees=(data.costs||[]).reduce((sum,c)=>sum+Math.max(n(c.estimate),n(c.actual)),0);
    const low=cif+duty+vat+fees+n(vrt.low),high=cif+duty+vat+fees+n(vrt.high);
    const paid=Math.min(n(invoice.paidJpy),invoiceTotal)/Math.max(rate,0.000001)
      +(data.costs||[]).reduce((sum,c)=>sum+(c.status==="paid"?n(c.actual):0),0)
      +Object.values(data.charges||{}).reduce((sum,c)=>sum+(c.status==="paid"?n(c.actual):0),0);
    const invoiceBalance=Math.max(invoiceTotal-n(invoice.paidJpy),0);
    return {rate,low,high,paid,remaining:Math.max(high-paid,0),invoiceBalance};
  };
  const status=c=>c.invoiceBalance>0?"Payment due":"On track";
  const badge=c=>`<span class="status ${c.invoiceBalance>0?"due":""}">${status(c)}</span>`;
  const progress=c=>c.high>0?Math.min(c.paid/c.high*100,100):0;
  const range=c=>`<span class="range">${pair(c.low,c.rate)}<span aria-hidden="true">–</span>${pair(c.high,c.rate)}</span>`;
  const open=car=>`<a class="open" href="car.html?id=${encodeURIComponent(car.id)}">Open tracker →</a>`;
  function option(car,c,variant) {
    const p=progress(c),remaining=pair(c.remaining,c.rate),paid=pair(c.paid,c.rate),projected=range(c);
    const heading=`<div class="photo-hero">${photo(car.data)}<div class="photo-hero-caption"><div><h2>${esc(carName(car.data))}</h2><div class="plate">${esc(field(car.data,"Singapore plate")||field(car.data,"Irish plate")||"Plate not added")} · ${esc(field(car.data,"Year of manufacture"))}</div></div>${badge(c)}</div></div>`;
    const progressBar=`<div class="budget-progress"><div class="progress"><span style="width:${p}%"></span></div><div class="progress-copy"><span>${Math.round(p)}% of high estimate paid</span><span>100%</span></div></div>`;
    const payStatus=c.invoiceBalance>0
      ?`<div class="payment-status due"><span class="label">Invoice payment due</span><strong>${pair(c.invoiceBalance/Math.max(c.rate,0.000001),c.rate)}</strong><small>Due ${esc(dateText(car.data.invoice?.dueDate))}</small></div>`
      :`<div class="payment-status"><span class="label">Invoice status</span><strong>No invoice balance due</strong></div>`;
    const footer=open(car);
    if(variant===1)return `<article class="card simple-summary">${heading}<div class="info-body">
      <span class="info-primary">Estimated left to spend</span><strong class="info-big">${remaining}</strong>
      <p class="explanation">This is the high estimate minus what you have paid so far.</p>${progressBar}
      <div class="budget-rows"><div class="budget-row"><span>Estimated total</span><strong>${projected}</strong></div><div class="budget-row"><span>Paid to date</span><strong>${paid}</strong></div></div>
      ${payStatus}${footer}</div></article>`;
    if(variant===2)return `<article class="card three-amounts">${heading}<div class="info-body">
      <span class="info-primary">The full estimated cost</span><div class="info-grid">
        <div class="info-box"><span class="label">Estimated total · low to high</span><strong>${projected}</strong></div>
        <div class="info-box"><span class="label">Paid so far</span><strong>${paid}</strong></div>
        <div class="info-box"><span class="label">Estimated left to spend</span><strong>${remaining}</strong></div>
      </div>${progressBar}${payStatus}${footer}</div></article>`;
    if(variant===3)return `<article class="card paid-vs-left">${heading}<div class="info-body">
      <span class="info-primary">Your import budget</span><div class="paid-left">
        <div><span class="label">Already paid</span><strong class="info-big">${paid}</strong></div>
        <div><span class="label">Still estimated to pay</span><strong class="info-big">${remaining}</strong></div>
      </div>${progressBar}
      <div class="estimate-range"><span class="label">Estimated total</span>${projected}</div>
      ${payStatus}${footer}</div></article>`;
    if(variant===4)return `<article class="card invoice-first">${heading}<div class="info-body">
      ${payStatus}<span class="info-primary" style="display:block;margin-top:16px">Overall import budget</span>
      <div class="budget-rows"><div class="budget-row"><span>Lower total estimate</span><strong>${pair(c.low,c.rate)}</strong></div>
        <div class="budget-row"><span>Higher total estimate</span><strong>${pair(c.high,c.rate)}</strong></div>
        <div class="budget-row"><span>Paid to date</span><strong>${paid}</strong></div>
        <div class="budget-row"><span>Left to spend · high estimate</span><strong>${remaining}</strong></div></div>
      ${progressBar}${footer}</div></article>`;
    return `<article class="card budget-card">${heading}<div class="info-body">
      <div class="budget-total"><span class="info-primary">Estimated total · high</span><strong class="info-big">${pair(c.high,c.rate)}</strong><span class="small">This is the upper end of your current estimate.</span></div>
      <div class="paid-left"><div><span class="label">Paid so far</span><strong class="info-big">${paid}</strong></div><div><span class="label">Still to spend</span><strong class="info-big">${remaining}</strong></div></div>
      ${progressBar}<div class="estimate-range"><span class="label">Lower estimate</span>${pair(c.low,c.rate)}</div>
      ${payStatus}${footer}</div></article>`;
  }
  try {
    const fleet=ImportTrackerStore.loadFleet();
    $("options").innerHTML=fleet.cars.length?fleet.cars.map(car=>[1,2,3,4,5].map((variant,index)=>`<section class="option"><div class="option-label"><strong>Example ${variant} · ${["Simple answer","Three amounts","Paid vs. left","Invoice first","Budget summary"][index]}</strong><span>${esc(carName(car.data))}</span></div>${option(car,calculate(car.data),variant)}</section>`).join("")).join(""):`<div class="empty">No cars yet. Add one from the home page to compare card information styles.</div>`;
  } catch(error) {
    console.error("Could not load card style previews:",error);
    $("options").innerHTML=`<div class="empty">Could not load your saved cars: ${esc(error.message)}</div>`;
  }
  const themeToggle=$("themeToggle");
  if(localStorage.getItem("mazda3-import-theme")==="dark")document.documentElement.dataset.theme="dark";
  themeToggle.textContent=document.documentElement.dataset.theme==="dark"?"Light mode":"Dark mode";
  themeToggle.addEventListener("click",()=>{
    const dark=document.documentElement.dataset.theme!=="dark";
    document.documentElement.dataset.theme=dark?"dark":"light";
    localStorage.setItem("mazda3-import-theme",dark?"dark":"light");
    themeToggle.textContent=dark?"Light mode":"Dark mode";
  });
})();
