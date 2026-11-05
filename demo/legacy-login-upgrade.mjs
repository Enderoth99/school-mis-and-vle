// Keep archive teacher workflows and stored records intact. Admin testing belongs in the current MIS.
const current='/wist-mis-testing/login.html?account=admin&release=20261031-admin-80';
document.addEventListener('submit',event=>{
 if(event.target.id!=='login-form')return;
 if(document.querySelector('#username')?.value.trim().toLowerCase()!=='admin')return;
 event.preventDefault();event.stopImmediatePropagation();location.replace(current);
},true);
