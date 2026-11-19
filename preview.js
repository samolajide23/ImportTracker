(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const n=value=>Number(value)||0;
  const euro=value=>new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
  const yen=value=>`¥${new Intl.NumberFormat("en-IE",{maximumFractionDigits:0}).format(Number.isFinite(value)?value:0)}`;
  const date=value=>value?new Intl.DateTimeFormat("en-IE",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T00:00:00`)):"Date to confirm";
  const field=(data,label)=>data.vehicle?.find(item=>item.label===label)?.value||"";
  const title=data=>field(data,"Model").split(",")[0].trim()||"New car";
  const totalJpy=data=>n(data.invoice?.fob)+n(data.invoice?.freight)+n(data.invoice?.other)+n(data.invoice?.insurance);
  const calculate=data=>{
    const invoice=data.invoice||{},vrt=data.vrt||{},rate=n(invoice.rate),invoiceTotal=totalJpy(data);
    const cif=rate>0?invoiceTotal/rate:0,duty=cif*n(invoice.dutyRate),vat=invoice.vatEnabled?(cif+duty)*0.23:0;
    const fees=(data.costs||[]).reduce((sum,c)=>sum+Math.max(n(c.estimate),n(c.actual)),0);
    const low=cif+duty+vat+fees+n(vrt.low),high=cif+duty+vat+fees+n(vrt.high);
    const paid=Math.min(n(invoice.paidJpy),invoiceTotal)/Math.max(rate,0.000001)
      +(data.costs||[]).reduce((sum,c)=>sum+(c.status==="paid"?n(c.actual):0),0)
      +Object.values(data.charges||{}).reduce((sum,c)=>sum+(c.status==="paid"?n(c.actual):0),0);
    return {rate,cif,duty,vat,fees,low,high,paid,remaining:Math.max(high-paid,0),invoiceBalance:Math.max(invoiceTotal-n(invoice.paidJpy),0)/Math.max(rate,0.000001)};
  };
  const pair=(value,rate)=>`${euro(value)}<small>≈ ${yen(value*n(rate))}</small>`;
  const shortPlate=data=>field(data,"Singapore plate")||field(data,"Irish plate")||"Plate not added";
  const carModel=(car)=>title(car.data);
  function collectEvents(cars) {
    const events=[];
    for(const car of cars) {
      const d=car.data||{},calc=calculate(d),i=d.invoice||{},v=d.vrt||{};
      const actualEntry=d.shipment?.actualEntryDate,eta=d.shipment?.eta;
      const push=(name,dateValue,amount,detail,kind="Payment")=>events.push({id:car.id,car:carModel(car),name,date:dateValue||"",amount,rate:calc.rate,detail,kind});
      if(calc.invoiceBalance>0)push("Invoice balance",i.dueDate,calc.invoiceBalance,"Invoice payment");
      for(const [key,name,amount,detail] of [
        ["duty","Customs duty",calc.duty,actualEntry?"At recorded entry date":eta?"On ETA · planning estimate":"On arrival · date to confirm"],
        ["vat","Import VAT",calc.vat,actualEntry?"At recorded entry date":eta?"On ETA · planning estimate":"On arrival · date to confirm"],
        ["vrt","VRT",n(v.high),actualEntry?"Within 30 days of actual entry · Revenue":eta?"ETA + 30 days · planning only; confirm actual entry":"Within 30 days of entry · date to confirm"]
      ]) {
        const record=d.charges?.[key]||{status:"estimated",actual:0,date:""};
        const value=record.status==="charged"&&n(record.actual)>0?n(record.actual):amount;
        if(record.status!=="paid"&&value>0)push(name,record.date,value,detail,"Estimate");
      }
      for(const cost of d.costs||[]) {
        if(cost.status==="paid")continue;
        const amount=cost.status==="charged"&&n(cost.actual)>0?n(cost.actual):Math.max(n(cost.estimate),n(cost.actual));
        const detail=cost.dateMode==="manual"?"Manual date":ImportTrackerStore.costDateOffset(cost.category)===0?actualEntry?"Based on actual entry date":eta?"Planning date based on ETA":"Date to confirm":"Date to confirm";
        if(amount>0)push(cost.category,cost.date,amount,detail,"Cost");
      }
      if(actualEntry)push("Vehicle entered Ireland",actualEntry, null,`Recorded actual entry date${d.shipment.actualEntrySource?` · Source: ${d.shipment.actualEntrySource}`:""} · Revenue deadlines start from entry`,"Milestone");
      if(d.shipment?.customsReleaseDate)push("Customs release",d.shipment.customsReleaseDate,null,`Recorded customs release date${d.shipment.customsReleaseSource?` · Source: ${d.shipment.customsReleaseSource}`:""}`,"Milestone");
      for(const stage of d.stages||[]) {
        if(stage.date&&stage.status!=="Done"&&stage.name!=="Pay invoice balance") {
          const basis=stage.dateTrigger?(stage.dateMode==="manual"?"Manual date override":stage.dateBasis==="actualEntryDate"?"Based on actual entry date":"Planning date based on ETA"):"";
          const etaSource=stage.name==="Shipping and arrival"&&d.shipment?.etaSource?`ETA source: ${d.shipment.etaSource}`:"";
          events.push({id:car.id,car:carModel(car),name:stage.name,date:stage.date,amount:null,rate:calc.rate,detail:[stage.detail,basis,etaSource].filter(Boolean).join(" · "),kind:"Next step"});
        }
      }
    }
    return events.sort((a,b)=>(a.date||"9999-12-31").localeCompare(b.date||"9999-12-31")).slice(0,20);
  }
  function carCard(car,variant) {
    const d=car.data||{},c=calculate(d),plate=shortPlate(d),year=field(d,"Year of manufacture");
    const href=`car.html?id=${encodeURIComponent(car.id)}`;
    const due=c.invoiceBalance>0?`<strong>${yen(c.invoiceBalance*c.rate)} due</strong><small>Invoice balance · ${esc(date(d.invoice?.dueDate))}</small>`:`<strong>${pair(c.remaining,c.rate)} remaining</strong><small>Estimated high-end balance</small>`;
    if(variant===1)return `<article class="vehicle-card"><div class="card-heading"><div><h2>${esc(carModel(car))}</h2><p>${esc(plate)}${year?` · ${esc(year)}`:""}</p></div><span class="pill warning">${c.invoiceBalance>0?"Payment due":"Importing"}</span></div><div class="due-banner">${due}</div><div class="metrics"><div><small>Estimated total</small><strong>${pair(c.low,c.rate)}–${pair(c.high,c.rate)}</strong></div><div><small>Paid</small><strong>${pair(c.paid,c.rate)}</strong></div><div><small>Remaining</small><strong>${pair(c.remaining,c.rate)}</strong></div></div><a class="open-link" href="${href}">Open tracker →</a></article>`;
    if(variant===2)return `<a class="ledger-car" href="${href}"><span class="ledger-car-title"><strong>${esc(carModel(car))}</strong><small>${esc(plate)}${year?` · ${esc(year)}`:""}</small></span><span><small>Expected total</small><strong>${pair(c.low,c.rate)}–${pair(c.high,c.rate)}</strong></span><span><small>Paid</small><strong>${pair(c.paid,c.rate)}</strong></span><span><small>Due next</small><strong>${c.invoiceBalance>0?yen(c.invoiceBalance*c.rate):"—"}</strong><small>${esc(c.invoiceBalance>0?date(d.invoice?.dueDate):"No invoice balance")}</small></span><span class="ledger-arrow">↗</span></a>`;
    if(variant===3)return `<article class="journey-car"><div class="journey-number">${String(carsIndex(car)+1).padStart(2,"0")}</div><div class="journey-info"><p class="eyebrow">${esc(plate)}${year?` / ${esc(year)}`:""}</p><h2>${esc(carModel(car))}</h2><div class="journey-total">${pair(c.low,c.rate)} <span>to</span> ${pair(c.high,c.rate)}</div><p class="muted">Estimated landed cost · ${pair(c.paid,c.rate)} recorded paid</p><a href="${href}">See import journey <span aria-hidden="true">→</span></a></div><div class="journey-due">${due}</div></article>`;
    if(variant===4) {
      const progress=c.high>0?Math.min(c.paid/c.high*100,100):0;
      return `<article class="focus-car"><div class="focus-head"><div><h2>${esc(carModel(car))}</h2><p>${esc(plate)}${year?` · ${esc(year)}`:""}</p></div><span class="pill">${c.invoiceBalance>0?"Action needed":"On track"}</span></div><div class="focus-body"><div class="donut" style="--progress:${progress}%"><span>${Math.round(progress)}<small>% paid</small></span></div><div class="focus-values"><div><small>Projected range</small><strong>${pair(c.low,c.rate)}–${pair(c.high,c.rate)}</strong></div><div><small>Paid to date</small><strong>${pair(c.paid,c.rate)}</strong></div><div><small>Next payment</small><strong>${c.invoiceBalance>0?yen(c.invoiceBalance*c.rate):"Nothing scheduled"}</strong><small>${c.invoiceBalance>0?esc(date(d.invoice?.dueDate)):"No invoice balance"}</small></div></div></div><a class="focus-open" href="${href}">View car details</a></article>`;
    }
    return `<article class="command-car"><div class="command-top"><div><span class="eyebrow">${esc(plate)}${year?` · ${esc(year)}`:""}</span><h2>${esc(carModel(car))}</h2></div><span class="command-status">${c.invoiceBalance>0?"● PAYMENT DUE":"● TRACKING"}</span></div><div class="command-grid"><div><small>LANDED LOW</small><strong>${pair(c.low,c.rate)}</strong></div><div><small>LANDED HIGH</small><strong>${pair(c.high,c.rate)}</strong></div><div><small>PAID</small><strong>${pair(c.paid,c.rate)}</strong></div><div><small>TO SPEND</small><strong>${pair(c.remaining,c.rate)}</strong></div></div><div class="command-bottom"><span>${c.invoiceBalance>0?`NEXT: ${yen(c.invoiceBalance*c.rate)} by ${esc(date(d.invoice?.dueDate))}`:"NO INVOICE BALANCE"}</span><a href="${href}">OPEN →</a></div></article>`;
  }
  function carsIndex(car) { return allCars.indexOf(car); }
  function eventCard(event,variant) {
    const amount=event.amount===null?`<span class="event-step">STEP</span>`:`<strong>${euro(event.amount)}</strong><small>≈ ${yen(event.amount*n(event.rate))}</small>`;
    const href=`car.html?id=${encodeURIComponent(event.id)}`,eventDate=date(event.date);
    if(variant===1)return `<a class="event-row" href="${href}"><time>${esc(eventDate)}</time><span><strong>${esc(event.car)} · ${esc(event.name)}</strong><small>${esc(event.detail)}</small></span><span class="event-amount">${amount}</span></a>`;
    if(variant===2)return `<a class="ledger-event" href="${href}"><span>${esc(eventDate)}</span><strong>${esc(event.car)} · ${esc(event.name)}</strong><span>${esc(event.kind)} · ${esc(event.detail)}</span><b>${event.amount===null?"Next step":pair(event.amount,event.rate)}</b></a>`;
    if(variant===3)return `<a class="journey-event" href="${href}"><span class="event-dot"></span><time>${esc(eventDate)}</time><div><strong>${esc(event.name)}</strong><small>${esc(event.car)} · ${esc(event.detail)}</small></div><b>${event.amount===null?"Next step":pair(event.amount,event.rate)}</b></a>`;
    if(variant===4)return `<a class="focus-event" href="${href}"><span class="focus-event-date">${esc(eventDate)}</span><span><strong>${esc(event.name)}</strong><small>${esc(event.car)} · ${esc(event.detail)}</small></span><b>${event.amount===null?"Step":`${euro(event.amount)}<small>≈ ${yen(event.amount*n(event.rate))}</small>`}</b></a>`;
    return `<a class="command-event" href="${href}"><span class="command-date">${esc(eventDate)}</span><span><strong>${esc(event.car)} / ${esc(event.name)}</strong><small>${esc(event.kind)} · ${esc(event.detail)}</small></span><b>${event.amount===null?"NEXT STEP":pair(event.amount,event.rate)}</b></a>`;
  }
  let allCars=[];
  try {
    const fleet=ImportTrackerStore.loadFleet();
    allCars=fleet.cars;
    const variant=Number(document.body.dataset.variant)||1;
    $("carList").innerHTML=allCars.length?allCars.map(car=>carCard(car,variant)).join(""):`<div class="empty-state">No cars yet. Add one from the home page to get started.</div>`;
    const events=collectEvents(allCars);
    $("eventList").innerHTML=events.length?events.map(event=>eventCard(event,variant)).join(""):`<div class="empty-state">No payments or dated steps are recorded yet.</div>`;
    const carCount=$("carCount");if(carCount)carCount.textContent=String(allCars.length);
    const nextEvent=events.find(event=>event.amount!==null);
    const nextAmount=$("nextAmount");if(nextAmount)nextAmount.innerHTML=nextEvent?`${esc(nextEvent.car)}: ${pair(nextEvent.amount,nextEvent.rate)} by ${esc(date(nextEvent.date))}`:"No payments scheduled";
    const totals=allCars.reduce((sum,car)=>{const c=calculate(car.data);sum.low+=c.low;sum.high+=c.high;sum.paid+=c.paid;sum.remaining+=c.remaining;sum.lowJpy+=c.low*c.rate;sum.highJpy+=c.high*c.rate;sum.paidJpy+=c.paid*c.rate;sum.remainingJpy+=c.remaining*c.rate;return sum;},{low:0,high:0,paid:0,remaining:0,lowJpy:0,highJpy:0,paidJpy:0,remainingJpy:0});
    for(const [id,value,yenValue] of [["fleetLow",totals.low,totals.lowJpy],["fleetHigh",totals.high,totals.highJpy],["fleetPaid",totals.paid,totals.paidJpy],["fleetRemaining",totals.remaining,totals.remainingJpy]]) {
      const element=$(id);if(element)element.innerHTML=`${euro(value)}<small>≈ ${yen(yenValue)}</small>`;
    }
    const chart=$("fleetChart");
    if(chart)chart.innerHTML=`<div class="fleet-chart-bar"><span style="width:${totals.high?Math.min(totals.paid/totals.high*100,100):0}%"></span></div><div class="fleet-chart-label"><span>Paid ${euro(totals.paid)} <small>≈ ${yen(totals.paidJpy)}</small></span><span>Estimated high ${euro(totals.high)} <small>≈ ${yen(totals.highJpy)}</small></span></div>`;
  } catch(error) {
    console.error("Could not load preview data:",error);
    $("carList").innerHTML=`<div class="empty-state error">${esc(error.message)}</div>`;
    $("eventList").innerHTML="";
  }
})();
