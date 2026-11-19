(() => {
  const $=id=>document.getElementById(id);
  const n=value=>Number(value)||0;
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const money=value=>new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(value||0);
  const yen=value=>`¥${new Intl.NumberFormat("en-IE",{maximumFractionDigits:0}).format(value||0)}`;
  const pair=(value,rate)=>`<span class="money">${money(value)}<small>≈ ${yen(value*n(rate))}</small></span>`;
  const field=(data,label)=>data.vehicle?.find(item=>item.label===label)?.value||"";
  const carName=data=>field(data,"Model").split(",")[0].trim()||"Car details not added";
  const dateText=value=>value?new Intl.DateTimeFormat("en-IE",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T00:00:00`)):"Date to confirm";
  const eventTitle=e=>`${esc(e.car)} · ${esc(e.name)}`;
  const href=e=>`car.html?id=${encodeURIComponent(e.id)}`;
  const statusText=e=>e.kind==="step"?"Next step":e.kind==="payment"?"Payment due":e.status==="charged"?"Charged · unpaid":e.status==="quoted"?"Quoted":"Estimate";
  const statusClass=e=>e.kind==="step"?"step":e.kind==="payment"||e.status==="charged"?"due":"estimate";
  const timing=e=>{
    if(e.date)return dateText(e.date);
    if(/30 days/i.test(e.detail||""))return "Within 30 days · arrival date needed";
    if(/arrival/i.test(e.detail||""))return "On arrival · date needed";
    return "Date to confirm";
  };
  function collectEvents(fleet) {
    const events=[];
    for(const car of fleet.cars) {
      const d=car.data||{},i=d.invoice||{},v=d.vrt||{},rate=n(i.rate);
      ImportTrackerStore.syncArrivalDates(d);
      const total=n(i.fob)+n(i.freight)+n(i.other)+n(i.insurance),balance=Math.max(total-n(i.paidJpy),0);
      const push=(kind,name,date,detail,amount,status)=>events.push({id:car.id,car:carName(d),kind,name,date:date||"",detail,amount,rate,status});
      if(balance>0)push("payment","Invoice balance",i.dueDate,"Invoice payment",balance/Math.max(rate,0.000001),"due");
      const cif=rate>0?total/rate:0,duty=cif*n(i.dutyRate),vat=i.vatEnabled?(cif+duty)*0.23:0;
      for(const [key,name,estimate,detail] of [["duty","Customs duty",duty,"On arrival"],["vat","Import VAT",vat,"On arrival"],["vrt","VRT",n(v.high),"Within 30 days of arrival"]]) {
        const record=d.charges?.[key]||{actual:0,status:"estimated",date:""};
        const amount=record.status==="charged"&&n(record.actual)>0?n(record.actual):estimate;
        if(record.status!=="paid"&&amount>0)push("charge",name,record.date,detail,amount,record.status||"estimated");
      }
      for(const cost of d.costs||[]) {
        if(cost.status==="paid")continue;
        const amount=cost.status==="charged"&&n(cost.actual)>0?n(cost.actual):Math.max(n(cost.estimate),n(cost.actual));
        const offset=ImportTrackerStore.costDateOffset(cost.category);
        const detail=cost.dateMode==="manual"
          ?cost.date?"Manually scheduled":"Date to confirm"
          :offset===0?"On arrival"
          :offset===31?"After VRT · day 31 estimate":"Date to confirm";
        if(amount>0)push("cost",cost.category,cost.date,detail,amount,cost.status||"estimated");
      }
      for(const stage of d.stages||[]) {
        if(stage.date&&stage.status!=="Done"&&stage.name!=="Pay invoice balance")push("step",stage.name,stage.date,stage.detail,null,"step");
      }
    }
    return events.sort((a,b)=>(a.date||"9999-12-31").localeCompare(b.date||"9999-12-31")).slice(0,20);
  }
  const entry=e=>`<div class="row"><div class="row-main"><a class="event-title" href="${href(e)}">${eventTitle(e)}</a><div class="muted">${esc(timing(e))} · ${esc(statusText(e))}</div></div><div>${e.amount===null?"—":pair(e.amount,e.rate)}</div></div>`;
  const timelineEntry=e=>`<div class="timeline-item"><span class="date">${esc(timing(e))}</span><div class="timeline-main"><a class="event-title" href="${href(e)}">${eventTitle(e)}</a><div class="muted">${esc(e.detail||"")}</div></div><div class="event-amount">${e.amount===null?"Next step":pair(e.amount,e.rate)}</div></div>`;
  function grouped(events,category) {
    const groups={
      dated:events.filter(e=>e.date),
      arrival:events.filter(e=>!e.date&&/arrival/i.test(e.detail||"")&&!/30 days/i.test(e.detail||"")),
      registration:events.filter(e=>!e.date&&/30 days|after vrt/i.test(e.detail||"")),
      unknown:events.filter(e=>!e.date&&!/arrival|30 days|after vrt/i.test(e.detail||""))
    };
    const labels={dated:"A date is set",arrival:"When the car arrives · date needed",registration:"Within 30 days · date needed",unknown:"Date still to confirm"};
    return Object.entries(groups).filter(([,items])=>items.length).map(([key,items])=>`<div class="group"><h3>${labels[key]}</h3>${items.map(e=>`<div class="group-item"><a href="${href(e)}"><span class="event-title">${eventTitle(e)}</span><span class="muted">${esc(e.detail||"")}</span></a>${e.amount===null?"—":pair(e.amount,e.rate)}</div>`).join("")}</div>`).join("");
  }
  function calendarGroup(e) {
    if(e.date)return {label:new Intl.DateTimeFormat("en-IE",{month:"long",year:"numeric"}).format(new Date(`${e.date}T00:00:00`)),note:"Scheduled date"};
    if(/30 days|after vrt/i.test(e.detail||""))return {label:"After arrival",note:"VRT / registration"};
    if(/arrival/i.test(e.detail||""))return {label:"On arrival",note:"Arrival date needed"};
    return {label:"Date to confirm",note:"Not scheduled"};
  }
  function calendarView(events) {
    const groups=new Map();
    for(const e of events) {
      const {label,note}=calendarGroup(e);
      if(!groups.has(label))groups.set(label,{note,events:[]});
      groups.get(label).events.push(e);
    }
    return `<div class="calendar-list">${[...groups].map(([label,group])=>`<div class="calendar-block"><div class="calendar-date">${esc(label)}<small>${esc(group.note)}</small></div><div>${group.events.map(e=>`<div class="calendar-item"><a href="${href(e)}"><span class="event-title">${eventTitle(e)}</span><span class="muted">${e.date?esc(dateText(e.date)):esc(e.detail||"")}</span></a>${e.amount===null?"—":pair(e.amount,e.rate)}</div>`).join("")}</div></div>`).join("")}</div>`;
  }
  function ledger(events) {
    return `<div style="overflow-x:auto"><table class="ledger"><thead><tr><th>Date / timing</th><th>Payment</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead><tbody>${events.map(e=>`<tr><td>${esc(timing(e))}</td><td><a href="${href(e)}">${eventTitle(e)}</a></td><td><span class="status ${statusClass(e)}">${esc(statusText(e))}</span></td><td class="money">${e.amount===null?"—":pair(e.amount,e.rate)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function render(car,events,index) {
    const title=esc(carName(car.data)),dated=events.find(e=>e.amount!==null&&e.date)||events.find(e=>e.amount!==null);
    const empty=`<div class="empty">No payments or dated steps are recorded.</div>`;
    if(index===1) {
      const tasks=ImportTrackerStore.collectTodoItems(car),shownTasks=tasks.slice(0,3);
      const todoList=tasks.length?shownTasks.map(task=>`<div class="focus-task"><span class="task-check" aria-hidden="true"></span><div><a class="event-title" href="${href({id:car.id})}">${esc(task.title)}</a><div class="muted">${esc(task.date?dateText(task.date):task.status)}${task.detail?` · ${esc(task.detail)}`:""}</div></div><a class="task-link" href="${href({id:car.id})}">Open →</a></div>`).join(""):`<div class="muted">All caught up.</div>`;
      const todoSection=`<section class="focus-tasks"><h3><span>To do</span><span class="muted">${tasks.length} open</span></h3>${todoList}${tasks.length>3?`<a class="task-link" href="${href({id:car.id})}">View all ${tasks.length} tasks →</a>`:""}</section>`;
      return `<div class="view"><div class="section-title"><div><h2>Next payment</h2><p>${title}</p></div><span class="badge">${dated?esc(statusText(dated)):"No payment date"}</span></div>${dated?`<a href="${href(dated)}" style="color:inherit;text-decoration:none"><div class="focus-amount"><div><span class="muted">${esc(dated.name)} · ${esc(timing(dated))}</span><div class="event-title">Open payment details →</div></div>${pair(dated.amount,dated.rate)}</div></a><h3 style="font-size:12px;margin:14px 0 0">Other planned costs</h3><div class="focus-list">${events.filter(e=>e!==dated).slice(0,4).map(entry).join("")}</div>${todoSection}<div class="unknown">Costs marked “date to confirm” are estimates, not scheduled bills.</div>`:todoSection+empty}</div>`;
    }
    if(index===2)return `<div class="view"><div class="section-title"><div><h2>Payment timeline</h2><p>${title} · earliest dates first</p></div></div>${events.length?`<div class="timeline">${events.map(timelineEntry).join("")}</div>`:empty}</div>`;
    if(index===3)return `<div class="view"><div class="section-title"><div><h2>When will I pay?</h2><p>${title} · grouped by timing</p></div></div>${events.length?grouped(events):empty}</div>`;
    if(index===4)return `<div class="view"><div class="section-title"><div><h2>Payment calendar</h2><p>${title} · month or milestone</p></div></div>${events.length?calendarView(events):empty}</div>`;
    return `<div class="view"><div class="section-title"><div><h2>Payment register</h2><p>${title} · amounts and dates at a glance</p></div></div>${events.length?ledger(events):empty}</div>`;
  }
  try {
    const fleet=ImportTrackerStore.loadFleet();
    const titles=["Next payment focus","Chronological timeline","Grouped by when","Calendar / milestones","Payment register"];
    $("options").innerHTML=fleet.cars.length?fleet.cars.map(car=>{
      const events=collectEvents({cars:[car]});
      return titles.map((name,index)=>`<section class="option"><div class="option-head"><strong>Example ${index+1} · ${name}</strong><span>${esc(carName(car.data))}</span></div>${render(car,events,index+1)}</section>`).join("");
    }).join(""):`<div class="empty">No cars yet. Add one from the home page to compare payment views.</div>`;
  } catch(error) {
    console.error("Could not load payment previews:",error);
    $("options").innerHTML=`<div class="empty">Could not load saved payment data: ${esc(error.message)}</div>`;
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
