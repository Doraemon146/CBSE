document.addEventListener("DOMContentLoaded",()=>{
  const c=document.getElementById("stars");
  for(let i=0;i<(innerWidth<640?45:85);i++){
    const s=document.createElement("div");s.className="star";
    s.style.left=Math.random()*100+"%";s.style.top=Math.random()*100+"%";
    s.style.animationDelay=Math.random()*4+"s";c.appendChild(s);
  }
  document.getElementById("enter-btn").onclick=()=>location.href="login.html";
});
