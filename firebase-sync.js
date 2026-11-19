import {firebaseConfig} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const $=id=>document.getElementById(id);
const status=msg=>{$('syncStatus').textContent=msg};
const error=msg=>{$('syncError').textContent=msg||''};
const lock=on=>document.body.classList.toggle('sync-locked',on);
const ready=()=>window.householdApp;
let unsub=null,ref=null,connected=false,writing=false,dirty=false,timer=null,auth=null;
function reset(){if(unsub){unsub();unsub=null}if(timer)clearTimeout(timer);timer=null;ref=null;connected=false;writing=false;dirty=false;lock(true);$('firstSync').hidden=true;}
function showError(e){console.error(e);error((e&&e.message)||String(e));status('연결 또는 저장 오류 · 아래 메시지를 확인하세요')}
if(!firebaseConfig.apiKey||firebaseConfig.apiKey.includes('PASTE_')){
 status('설정 필요: firebase-config.js에 Firebase 웹 앱 정보를 입력하세요.');
 error('Firebase 설정 파일을 먼저 작성해야 합니다. 설치안내.txt를 참고하세요.');
}else{
 try{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);const db=getFirestore(app);
  $('loginBtn').onclick=async()=>{error('');try{await signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value)}catch(e){showError(e)}};
  $('registerBtn').onclick=async()=>{error('');if(!confirm('입력한 이메일로 새 계정을 만들까요?'))return;try{await createUserWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value)}catch(e){showError(e)}};
  $('signOut').onclick=()=>signOut(auth).catch(showError);
  onAuthStateChanged(auth,user=>{
   reset();error('');$('loginArea').hidden=!!user;$('signOut').hidden=!user;
   if(!user){status('로그인하면 PC와 휴대폰이 자동 동기화됩니다.');return}
   status('클라우드 자료 불러오는 중…');ref=doc(db,'users',user.uid,'household','main');
   unsub=onSnapshot(ref,snap=>{
    if(!snap.exists()){
      connected=false;lock(true);$('firstSync').hidden=false;status('클라우드에 데이터가 없습니다. 최초 업로드 방법을 선택하세요.');return;
    }
    $('firstSync').hidden=true;
    const data=snap.data().data;
    if(!data||!Array.isArray(data.entries)) {showError(new Error('클라우드 데이터 형식이 올바르지 않습니다.'));return}
    // While an unsaved local edit is pending, don't overwrite it with an older snapshot.
    if(dirty&&!snap.metadata.hasPendingWrites)return;
    try{ready().setState(data);connected=true;lock(false);status(snap.metadata.hasPendingWrites?'저장 중…':'동기화 완료 · PC와 휴대폰에서 같은 데이터 사용');error('')}catch(e){showError(e)}
   },showError);
  },showError);
  async function initializeRemote(useLocal){
   if(!ref)return;const data=useLocal?ready().getState():{salary1:3250000,salary2:3180000,target:60,budgets:{'생활비':450000,'관리비':200000,'보험료':500000,'구독':43890,'원민 용돈':500000,'승희 용돈':700000},entries:[],holdings:[]};
   try{status('최초 데이터 업로드 중…');await setDoc(ref,{data,updatedAt:serverTimestamp()});$('firstSync').hidden=true}catch(e){showError(e)}
  }
  $('uploadLocal').onclick=()=>initializeRemote(true);
  $('startEmpty').onclick=()=>{if(confirm('이 기기의 기존 데이터 대신 빈 가계부로 시작할까요? 기존 자료는 먼저 JSON 백업하세요.'))initializeRemote(false)};
  window.householdSyncSave=()=>{
   if(!connected||!ref)return;
   dirty=true;status('변경사항 저장 대기 중…');if(timer)clearTimeout(timer);
   timer=setTimeout(async()=>{
    if(writing){window.householdSyncSave();return}
    writing=true;const payload=ready().getState();
    try{await setDoc(ref,{data:payload,updatedAt:serverTimestamp()});dirty=false;status('클라우드에 저장 완료');error('')}
    catch(e){showError(e);dirty=true}
    finally{writing=false}
   },450);
  };
 }catch(e){showError(e)}
}
