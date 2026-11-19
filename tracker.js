(() => {
  const FLEET_KEY = "import-tracker-fleet-v1";
  const LEGACY_KEY = "mazda3-import-tracker-v1";
  const documents = [
    "Singapore vehicle record and deregistration certificate",
    "Commercial invoice as proof of price",
    "Payment receipts",
    "Bill of Lading (port of loading and duty-rate evidence)",
    "Statement on Origin or export certificate (if claiming 0% duty)",
    "CO₂ and NOx emissions evidence (CoC or manufacturer letter)",
    "Customs declaration and clearance agent paperwork",
    "Customs payment receipt (duty and VAT)",
    "Arrival photos, including odometer",
    "Owner ID, proof of address and PPS number",
    "NCTS registration receipt and Vehicle Registration Certificate",
    "NCT certificate",
    "Motor tax and insurance"
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
    {name:"Pay invoice balance",date:"2026-11-27",detail:"¥24,500 due at 14:11; time zone not stated",status:"Current"},
    {name:"Shipping and arrival",date:"",detail:"January 2027 was suggested; unverified — confirm with shipper",status:"Waiting"},
    {name:"Customs clearance",date:"",detail:"Arrange clearance agent; pay applicable duty and VAT on arrival",status:"Waiting"},
    {name:"Register and pay VRT",date:"",detail:"Within 30 days of arrival per one guide; confirm with NCTS",status:"Waiting"},
    {name:"Plates, NCT, tax and insurance",date:"",detail:"Confirm required sequence with NCTS",status:"Waiting"},
    {name:"Prepare and sell",date:"",detail:"Repairs, prep and sale planning",status:"Waiting"}
  ];
  const costCategories = [
    ["Clearance agent",150,"Estimate €150–€200"],["Port handling",60,"Estimate €50–€100"],
    ["NCT",60,"Confirm current fee"],["Plates",30,""],["Insurance",0,""],
    ["Motor tax",0,""],["Repairs and prep",0,""]
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  const costDateOffset = category => {
    const name=String(category||"").trim().toLowerCase();
    if(name==="clearance agent"||name==="port handling")return 0;
    if(["nct","plates","motor tax","insurance"].includes(name))return 31;
    return null;
  };
  const collectTodoItems = car => {
    const data=car.data||{},items=[];
    for(const [index,stage] of (data.stages||[]).entries()) {
      if(stage.status==="Done"||stage.name==="Pay invoice balance")continue;
      items.push({
        carId:car.id,kind:"stage",index,title:stage.name,detail:stage.detail||"",
        date:stage.date||"",status:stage.status||"Waiting",
        priority:stage.status==="Current"?0:stage.date?1:2
      });
    }
    for(const [index,document] of (data.documents||[]).entries()) {
      if(document.status==="Have")continue;
      items.push({
        carId:car.id,kind:"document",index,title:document.name,detail:document.notes||"",
        date:"",status:document.status==="Waiting"?"Waiting":"Need",
        priority:document.status==="Waiting"?4:3
      });
    }
    return items.sort((a,b)=>a.priority-b.priority||(a.date||"9999-12-31").localeCompare(b.date||"9999-12-31")||a.index-b.index);
  };
  const addDays = (value,days) => {
    if(!value)return "";
    const [year,month,day]=value.split("-").map(Number),date=new Date(year,month-1,day+days);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  };
  const syncArrivalDates = data => {
    const arrival=data.stages?.find(stage=>stage.name==="Shipping and arrival")?.date||"";
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
  };
  const defaultData = () => ({
    invoice:{fob:406000,freight:315000,other:24500,insurance:0,rate:175.05,paidJpy:721000,dueDate:"2026-11-27",dutyRate:0.1,vatEnabled:true},
    vrt:{omsp:0,co2:0,band:0,nox:0,low:1500,high:2850},
    charges:{duty:{actual:0,status:"estimated",date:"",dateMode:"auto"},vat:{actual:0,status:"estimated",date:"",dateMode:"auto"},vrt:{actual:0,status:"estimated",date:"",dateMode:"auto"}},
    costs:costCategories.map(([category,estimate,notes])=>({category,estimate,actual:0,status:"estimated",date:"",dateMode:"auto",notes,receipt:""})),
    documents:documents.map(name=>({name,status:"Need",notes:"",link:""})),
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
    if(raw) return validateFleet(JSON.parse(raw));
    const legacy=localStorage.getItem(LEGACY_KEY);
    const fleet=legacy
      ? {cars:[{id:"mazda-3-slg7315s",data:JSON.parse(legacy)}]}
      : {cars:[{id:"mazda-3-slg7315s",data:defaultData()}]};
    saveFleet(fleet);
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
    car.data=data;
    saveFleet(fleet);
  };
  const deleteCar = id => {
    const fleet=loadFleet();
    fleet.cars=fleet.cars.filter(car=>car.id!==id);
    saveFleet(fleet);
  };
  window.ImportTrackerStore={loadFleet,addCar,saveCar,deleteCar,defaultData,syncArrivalDates,costDateOffset,collectTodoItems};
})();
