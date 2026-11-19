(() => {
  const FLEET_KEY = "import-tracker-fleet-v1";
  const LEGACY_KEY = "mazda3-import-tracker-v1";
  const phases = ["Before arrival","Arrival & customs","Registration","Road-ready","Completion","Other"];
  const phaseOrder = phase => {
    const index=phases.indexOf(phase);
    return index<0?phases.length-1:index;
  };
  const documents = [
    {id:"vehicle-record",name:"Singapore vehicle record and deregistration certificate",phase:"Before arrival"},
    {id:"commercial-invoice",name:"Commercial invoice as proof of price",phase:"Before arrival"},
    {id:"payment-receipts",name:"Payment receipts",phase:"Before arrival"},
    {id:"bill-of-lading",name:"Bill of Lading (port of loading and duty-rate evidence)",phase:"Before arrival"},
    {id:"origin-proof",name:"Statement on Origin or export certificate (if claiming 0% duty)",phase:"Before arrival",optional:true},
    {id:"emissions-evidence",name:"CO₂ and NOx emissions evidence (CoC or manufacturer letter)",phase:"Registration"},
    {id:"customs-paperwork",name:"Customs declaration and clearance agent paperwork",phase:"Arrival & customs"},
    {id:"customs-receipt",name:"Customs payment receipt (duty and VAT)",phase:"Arrival & customs"},
    {id:"arrival-photos",name:"Arrival photos, including odometer",phase:"Arrival & customs"},
    {id:"owner-id",name:"Owner ID, proof of address and PPS number",phase:"Registration"},
    {id:"registration-record",name:"NCTS registration receipt and Vehicle Registration Certificate",phase:"Registration"},
    {id:"nct-certificate",name:"NCT certificate",phase:"Road-ready"},
    {id:"motor-tax-insurance",name:"Motor tax and insurance",phase:"Road-ready"}
  ];
  const vehicleFields = [
    ["Model","Mazda 3 4-door sedan, 1.5L petrol (1496 cc), 6-speed automatic (6EAT)"],
    ["Singapore plate","SLG7315S"],["VIN / chassis no.","JM6BM42A8G0338712"],["Engine no.","P520359077"],
    ["Colour / extras","Black, with sunroof"],["Unladen / max laden weight","1,321 kg / 1,835 kg"],
    ["Year of manufacture","2016"],["First registration","12 Oct 2016 (Singapore)"],
    ["Deregistered","29 Sep 2026"],["Ownership transfers","4 (up to 5 owners)"],
    ["Mileage","About 50,000 km (confirm from photos or inspection report)"],
    ["Irish plate","Will begin 162; county code depends on address, sequence assigned by Revenue"]
  ];
  const stages = [
    {id:"invoice-balance",name:"Pay invoice balance",phase:"Before arrival",priority:"critical",documentIds:["commercial-invoice","payment-receipts"],date:"2026-11-27",detail:"¥24,500 due at 14:11; time zone not stated",status:"Current"},
    {id:"shipping-arrival",name:"Shipping and arrival",phase:"Before arrival",priority:"high",documentIds:["vehicle-record","bill-of-lading"],date:"",detail:"Expected arrival date not confirmed with shipper",status:"Waiting"},
    {id:"customs-clearance",name:"Customs clearance",phase:"Arrival & customs",priority:"critical",documentIds:["commercial-invoice","payment-receipts","bill-of-lading","origin-proof","customs-paperwork","customs-receipt","arrival-photos"],date:"",detail:"Arrange clearance agent; pay applicable duty and VAT on arrival",status:"Waiting"},
    {id:"book-ncts",name:"Book NCTS appointment",phase:"Registration",priority:"critical",documentIds:["vehicle-record","owner-id","emissions-evidence","customs-paperwork"],date:"",dateMode:"auto",dateTrigger:"entry",dateOffsetDays:7,detail:"Revenue requires an appointment within seven days of bringing the vehicle into the State.",status:"Waiting"},
    {id:"register-vrt",name:"Register and pay VRT",phase:"Registration",priority:"critical",documentIds:["vehicle-record","owner-id","emissions-evidence","customs-paperwork","customs-receipt"],date:"",dateMode:"auto",dateTrigger:"entry",dateOffsetDays:30,detail:"Revenue requires registration within 30 days of bringing the vehicle into the State.",status:"Waiting"},
    {id:"road-ready",name:"Plates, NCT, tax and insurance",phase:"Road-ready",priority:"high",documentIds:["registration-record","nct-certificate","motor-tax-insurance"],date:"",detail:"Confirm required sequence with NCTS",status:"Waiting"},
    {id:"prepare-sell",name:"Prepare and sell",phase:"Completion",priority:"normal",documentIds:[],date:"",detail:"Repairs, prep and sale planning",status:"Waiting"}
  ];
  const shipmentDefaults = {
    seller:"",sellerCountry:"",exportCountry:"",originCountry:"",departurePort:"",destinationPort:"",
    vessel:"",bookingReference:"",etd:"",eta:"",etaSource:"",
    actualEntryDate:"",actualEntrySource:"",customsReleaseDate:"",customsReleaseSource:""
  };
  const costCategories = [
    ["Clearance agent",150,"Estimate €150–€200"],["Port handling",60,"Estimate €50–€100"],
    ["NCT",60,"Confirm current fee"],["Plates",30,""],["Insurance",0,""],
    ["Motor tax",0,""],["Repairs and prep",0,""]
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  const slug = value => String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item";
  const documentAliases = {
    "commercial-invoice":["Commercial invoice (¥745,500) as proof of price"],
    "payment-receipts":["Payment receipts (¥721,000 paid, ¥24,500 due)"],
    "bill-of-lading":["Bill of Lading, which shows the port of loading and decides the duty rate"],
    "origin-proof":["Statement on Origin or export certificate from the exporter, if claiming 0% duty"],
    "emissions-evidence":["CO₂ and NOx emissions evidence (certificate of conformity or manufacturer letter)"],
    "arrival-photos":["Photos at arrival, including the odometer"]
  };
  const documentTemplate = document => documents.find(template=>template.id===document?.id||template.name===document?.name)
    ||documents.find(template=>(documentAliases[template.id]||[]).some(alias=>slug(alias)===slug(document?.name)));
  const costDateOffset = category => {
    const name=String(category||"").trim().toLowerCase();
    if(name==="clearance agent"||name==="port handling")return 0;
    return null;
  };
  const collectTodoItems = car => {
    const data=car.data||{},items=[];
    for(const [index,stage] of (data.stages||[]).entries()) {
      if(stage.status==="Done"||stage.name==="Pay invoice balance")continue;
      if(stage.name==="Shipping and arrival"&&data.shipment?.actualEntryDate)continue;
      if(stage.name==="Customs clearance"&&data.shipment?.customsReleaseDate)continue;
      const sourceDetail=stage.name==="Shipping and arrival"&&data.shipment?.etaSource?`ETA source: ${data.shipment.etaSource}`:"";
      const dateBasis=!stage.dateTrigger?""
        :stage.dateMode==="manual"?"Manual date override"
        :data.shipment?.actualEntryDate?"Deadline based on actual entry date"
        :data.shipment?.eta?"Planning date based on ETA; confirm after entry"
        :"Date starts from actual entry into Ireland";
      items.push({
        carId:car.id,kind:"stage",index,title:stage.name,detail:[stage.detail,sourceDetail].filter(Boolean).join(" · "),
        phase:stage.phase||"Other",phaseOrder:phaseOrder(stage.phase||"Other"),priorityLabel:stage.priority||"normal",
        documents:(stage.documentIds||[]).map(id=>data.documents?.find(document=>document.id===id)).filter(Boolean).map(document=>({
          id:document.id,name:document.name,status:document.status||"Need",optional:!!document.optional
        })),
        date:stage.date||"",status:stage.status||"Waiting",dateBasis,
        priority:stage.status==="Current"?0:stage.date?1:2
      });
    }
    for(const [index,document] of (data.documents||[]).entries()) {
      if(document.status==="Have"||(document.optional&&document.status!=="Waiting"))continue;
      const phase=document.phase||documentTemplate(document)?.phase||"Other";
      items.push({
        carId:car.id,kind:"document",index,title:document.name,detail:document.notes||"",
        phase,phaseOrder:phaseOrder(phase),priorityLabel:document.optional?"optional":"high",documents:[],
        documentId:document.id,optional:!!document.optional,
        date:"",status:document.status==="Waiting"?"Waiting":"Need",
        priority:document.status==="Waiting"?4:3
      });
    }
    return items.sort((a,b)=>a.priority-b.priority||(a.date||"9999-12-31").localeCompare(b.date||"9999-12-31")||a.phaseOrder-b.phaseOrder||a.index-b.index);
  };
  const addDays = (value,days) => {
    if(!value)return "";
    const [year,month,day]=String(value).split("-").map(Number);
    if(!Number.isInteger(year)||!Number.isInteger(month)||!Number.isInteger(day))return "";
    const original=new Date(year,month-1,day);
    if(original.getFullYear()!==year||original.getMonth()!==month-1||original.getDate()!==day)return "";
    const date=new Date(year,month-1,day+days);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  };
  const syncArrivalDates = data => {
    const arrival=data.shipment?.actualEntryDate||data.shipment?.eta||"";
    for(const [key,offset] of [["duty",0],["vat",0],["vrt",30]]) {
      const record=data.charges?.[key];
      if(!record)continue;
      if(!record.dateMode)record.dateMode=record.date?"manual":"auto";
      if(record.dateMode!=="manual") {
        record.dateMode="auto";
        record.date=addDays(arrival,offset);
      }
    }
    for(const cost of data.costs||[]) {
      if(!cost.dateMode)cost.dateMode=cost.date?"manual":"auto";
      if(cost.dateMode!=="manual") {
        cost.dateMode="auto";
        const offset=costDateOffset(cost.category);
        cost.date=offset===null?"":addDays(arrival,offset);
      }
    }
    for(const stage of data.stages||[]) {
      if(stage.dateTrigger!=="entry")continue;
      if(!stage.dateMode)stage.dateMode=stage.date?"manual":"auto";
      if(stage.dateMode!=="manual") {
        stage.dateMode="auto";
        stage.date=arrival?addDays(arrival,Number(stage.dateOffsetDays)||0):"";
        stage.dateBasis=data.shipment?.actualEntryDate?"actualEntryDate":data.shipment?.eta?"eta":"";
      }
    }
  };
  const normalizeCarData = data => {
    if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Saved car data is invalid.");
    const before=JSON.stringify(data);
    const legacyArrival=Array.isArray(data.stages)?data.stages.find(stage=>stage.name==="Shipping and arrival")?.date||"":"";
    const hadEta=!!data.shipment&&typeof data.shipment==="object"&&!Array.isArray(data.shipment)
      &&Object.prototype.hasOwnProperty.call(data.shipment,"eta");
    data.shipment={...shipmentDefaults,...(data.shipment&&typeof data.shipment==="object"&&!Array.isArray(data.shipment)?data.shipment:{})};
    if(!hadEta)data.shipment.eta=legacyArrival;
    if(!Array.isArray(data.stages))data.stages=clone(stages);
    let arrivalStage=data.stages.find(stage=>stage.name==="Shipping and arrival");
    if(!arrivalStage) {
      arrivalStage={name:"Shipping and arrival",date:"",detail:"Expected arrival date not confirmed with shipper",status:"Waiting"};
      data.stages.push(arrivalStage);
    }
    arrivalStage.date=data.shipment.eta||"";
    const workflowDefaults=stages.filter(stage=>stage.dateTrigger==="entry");
    for(const template of stages) {
      let stage=data.stages.find(item=>item.name===template.name);
      if(!stage&&workflowDefaults.includes(template)) {
        stage=clone(template);
        data.stages.push(stage);
      }
      if(!stage)continue;
      if(!stage.id)stage.id=template.id;
      if(!stage.phase)stage.phase=template.phase;
      if(!stage.priority)stage.priority=template.priority;
      if(!Object.prototype.hasOwnProperty.call(stage,"documentIds"))stage.documentIds=clone(template.documentIds||[]);
      if(!Object.prototype.hasOwnProperty.call(stage,"dateTrigger"))stage.dateTrigger=template.dateTrigger;
      if(template.dateOffsetDays!==undefined&&!Object.prototype.hasOwnProperty.call(stage,"dateOffsetDays"))stage.dateOffsetDays=template.dateOffsetDays;
      if(template.dateTrigger&&!Object.prototype.hasOwnProperty.call(stage,"dateMode"))stage.dateMode=stage.date?"manual":"auto";
      if(stage.name==="Register and pay VRT"&&stage.detail==="Within 30 days of arrival per one guide; confirm with NCTS") {
        stage.detail=template.detail;
      }
    }
    for(const stage of data.stages) {
      if(!stage.id)stage.id=slug(stage.name);
      if(!stage.phase)stage.phase="Other";
      if(!Array.isArray(stage.documentIds))stage.documentIds=[];
    }
    const standardStageNames=new Set(stages.map(stage=>stage.name));
    data.stages=[
      ...stages.map(template=>data.stages.find(stage=>stage.name===template.name)).filter(Boolean),
      ...data.stages.filter(stage=>!standardStageNames.has(stage.name))
    ];
    if(!Array.isArray(data.documents))data.documents=[];
    for(const document of data.documents) {
      const template=documentTemplate(document);
      if(!document.id)document.id=template?.id||slug(document.name);
      if(!document.phase)document.phase=template?.phase||"Other";
      if(!Object.prototype.hasOwnProperty.call(document,"optional"))document.optional=!!template?.optional;
    }
    syncArrivalDates(data);
    return JSON.stringify(data)!==before;
  };
  const defaultData = () => ({
    shipment:{...shipmentDefaults},
    invoice:{fob:406000,freight:315000,other:24500,insurance:0,rate:175.05,paidJpy:721000,dueDate:"2026-11-27",dutyRate:0.1,vatEnabled:true},
    vrt:{omsp:0,co2:0,band:0,nox:0,low:1500,high:2850},
    charges:{duty:{actual:0,status:"estimated",date:"",dateMode:"auto"},vat:{actual:0,status:"estimated",date:"",dateMode:"auto"},vrt:{actual:0,status:"estimated",date:"",dateMode:"auto"}},
    costs:costCategories.map(([category,estimate,notes])=>({category,estimate,actual:0,status:"estimated",date:"",dateMode:"auto",notes,receipt:""})),
    documents:documents.map(document=>({...document,status:"Need",notes:"",link:""})),
    stages:clone(stages),
    vehicle:vehicleFields.map(([label,value])=>({label,value}))
  });
  const newCarData = () => {
    const data=defaultData();
    data.vehicle.forEach(field=>{field.value="";});
    data.invoice={fob:0,freight:0,other:0,insurance:0,rate:175.05,paidJpy:0,dueDate:"",dutyRate:0.1,vatEnabled:true};
    data.vrt={omsp:0,co2:0,band:0,nox:0,low:0,high:0};
    data.charges={duty:{actual:0,status:"estimated",date:"",dateMode:"auto"},vat:{actual:0,status:"estimated",date:"",dateMode:"auto"},vrt:{actual:0,status:"estimated",date:"",dateMode:"auto"}};
    data.costs.forEach(cost=>{cost.estimate=0;cost.notes="";});
    data.stages.forEach(stage=>{stage.date="";stage.status="Waiting";});
    data.stages[0].detail="Add this car's invoice balance and due date";
    return data;
  };
  const makeId = () => globalThis.crypto?.randomUUID?.() || `car-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const validateFleet = fleet => {
    if(!fleet || typeof fleet!=="object" || !Array.isArray(fleet.cars)) throw new Error("Saved fleet data is invalid.");
    if(fleet.cars.some(car=>!car || typeof car.id!=="string" || !car.id || !car.data || typeof car.data!=="object")) throw new Error("Saved car data is invalid.");
    return fleet;
  };
  const saveFleet = fleet => {
    try { localStorage.setItem(FLEET_KEY,JSON.stringify(fleet)); }
    catch(error) { console.error("Could not save fleet:",error); throw new Error("Could not save cars in this browser. Export a backup and check available storage."); }
  };
  const loadFleet = () => {
    const raw=localStorage.getItem(FLEET_KEY);
    let fleet;
    if(raw) fleet=validateFleet(JSON.parse(raw));
    else {
      const legacy=localStorage.getItem(LEGACY_KEY);
      fleet=legacy
        ? {cars:[{id:"mazda-3-slg7315s",data:JSON.parse(legacy)}]}
        : {cars:[{id:"mazda-3-slg7315s",data:defaultData()}]};
    }
    let changed=false;
    for(const car of fleet.cars)changed=normalizeCarData(car.data)||changed;
    if(changed||!raw)saveFleet(fleet);
    return fleet;
  };
  const addCar = () => {
    const fleet=loadFleet(), id=makeId();
    fleet.cars.push({id,data:newCarData()});
    saveFleet(fleet);
    return id;
  };
  const saveCar = (id,data) => {
    const fleet=loadFleet(), car=fleet.cars.find(item=>item.id===id);
    if(!car) throw new Error("This car no longer exists in the saved fleet.");
    normalizeCarData(data);
    car.data=data;
    saveFleet(fleet);
  };
  const deleteCar = id => {
    const fleet=loadFleet();
    fleet.cars=fleet.cars.filter(car=>car.id!==id);
    saveFleet(fleet);
  };
  window.ImportTrackerStore={loadFleet,addCar,saveCar,deleteCar,defaultData,normalizeCarData,syncArrivalDates,costDateOffset,collectTodoItems};
})();
