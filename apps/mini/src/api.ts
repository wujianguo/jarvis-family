import Taro from "@tarojs/taro"
export const ROOT="https://share.libms.top/family/api"
const TOKEN="woshi_session"
export const token=()=>Taro.getStorageSync<string>(TOKEN)
export const setToken=(value:string)=>Taro.setStorageSync(TOKEN,value)
export const clearToken=()=>Taro.removeStorageSync(TOKEN)
export async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",data?:unknown):Promise<T>{
 const r=await Taro.request<T&{error?:{code:string;message:string}}>({url:ROOT+path,method,data,header:{"Content-Type":"application/json",...(token()?{Authorization:`Bearer ${token()}`}:{})}})
 if(r.statusCode>=400)throw new Error(r.data?.error?.message||`请求失败 ${r.statusCode}`)
 return r.data
}
export async function wxCode(){const v=await Taro.login();if(!v.code)throw new Error("微信登录失败");return v.code}
export type Pickup={id:string;address:string;pickupCode:string;recipientName?:string|null;rawInfo?:string|null;status:string;source:string;createdAt:string}
