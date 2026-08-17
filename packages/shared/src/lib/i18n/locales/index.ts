import type { Language } from "../config";
import { th } from "./th";
import { en } from "./en";
import { my as myBase } from "./my";

/** Shape of every locale dictionary — derived from Thai (source of truth). */
export type Dict = typeof th;

/**
 * Burmese auth-flow strings added in the production auth upgrade.
 *
 * `my.ts` is a large append-only translation table; the auth section sits
 * beyond the safe edit window, so the new keys are merged here instead.
 * This keeps the Burmese locale at exact key parity with Thai/English
 * (enforced by tests/locale-parity.test.ts). Merge these into my.ts whenever
 * that file can be rewritten wholesale.
 */
const myAuthPatch = {
  continue: "ဆက်လုပ်ရန်",
  sendingCode: "ကုဒ်ပို့နေသည်...",
  otpTitle: "သင့်အီးမေးလ် အတည်ပြုပါ",
  otpDesc: "6 လုံးကုဒ်ကို {email} သို့ ပို့ထားပါသည်",
  resendIn: "{seconds} စက္ကန့်အတွင်း ကုဒ်ပြန်ပို့နိုင်သည်",
  resendNow: "ကုဒ် ပြန်ပို့ရန်",
  changeEmail: "အီးမေးလ် ပြောင်းရန်",
  invalidEmail: "မှန်ကန်သော အီးမေးလ် ဖြည့်ပါ",
  rateLimited: "ကုဒ်ပို့ရန် မကြာခဏလွန်းနေပါသည် ခဏစောင့်ပြီး ပြန်ကြိုးစားပါ",
  sendFailed: "ကုဒ်ပို့၍မရပါ ထပ်ကြိုးစားပါ",
  networkError: "ဆက်သွယ်မှု ပျက်ကွက်ပါသည် ထပ်ကြိုးစားပါ",
  otpInvalid: "အတည်ပြုကုဒ် မမှန်ပါ ထပ်ကြိုးစားပါ",
  otpExpired: "ကုဒ်သက်တမ်းကုန်ပါပြီ ကုဒ်အသစ် တောင်းပါ",
  otpTooMany: "မှားယွင်းမှု များလွန်းပါသည် ကုဒ်အသစ် တောင်းပါ",
  verifySuccess: "အောင်မြင်စွာ ဝင်ရောက်ပြီးပါပြီ",
  // ---- Google OAuth (primary login) ----
  welcome: "Velnox မှ ကြိုဆိုပါသည်",
  googleDesc: "သင့် Google အကောင့်ဖြင့် ဝင်ရောက်ပါ",
  googleContinue: "Google ဖြင့် ဆက်လုပ်ရန်",
  signingInGoogle: "Google သို့ ချိတ်ဆက်နေသည်...",
  googleError: "Google ဖြင့် ဝင်ရောက်၍မရပါ ထပ်ကြိုးစားပါ",
  googleCancelled: "ဝင်ရောက်မှုကို ပယ်ဖျက်လိုက်ပါသည်",
  noAccess: "ဤအကောင့်သည် ဤနေရာကို ဝင်ရောက်ခွင့်မရှိပါ",
  terms: "ဝင်ရောက်ခြင်းဖြင့် ဝန်ဆောင်မှုစည်းမျဉ်းနှင့် ကိုယ်ရေးအချက်အလက်မူဝါဒကို သဘောတူပါသည်",
  termsLink: "ဝန်ဆောင်မှုစည်းမျဉ်း",
  privacyLink: "ကိုယ်ရေးအချက်အလက်မူဝါဒ",
} satisfies Partial<Dict["auth"]>;

/**
 * Burmese strings added in the VelShop production e-commerce redesign.
 *
 * Same mechanism as `myAuthPatch`: my.ts is a large append-only table whose
 * tail sits beyond the safe edit window, so new keys are merged here instead.
 * This keeps the Burmese locale at exact key parity with Thai/English
 * (enforced by tests/locale-parity.test.ts). Merge these into my.ts whenever
 * that file can be rewritten wholesale.
 */
const myShopPatch = {
  header: {
    ariaWishlist: "အကြိုက်ဆုံးစာရင်း",
  } satisfies Partial<Dict["header"]>,
  footer: {
    colShop: "ဆိုင်",
    colHelp: "အကူအညီ",
    colLegal: "သတ်မှတ်ချက်များ",
    colVelnox: "Velnox",
    colSeller: "ရောင်းသူများ",
    allProducts: "ကုန်ပစ္စည်းအားလုံး",
    helpCenter: "အကူအညီစင်တာ",
    helpOrders: "မှာယူမှုများ",
    helpPayment: "ငွေပေးချေမှု",
    helpShipping: "ပို့ဆောင်မှု",
    helpReturns: "ငွေပြန်အမ်းခြင်း",
    contactUs: "ဆက်သွယ်ရန်",
    terms: "ဝန်ဆောင်မှုစည်းမျဉ်း",
    privacy: "ကိုယ်ရေးအချက်အလက်မူဝါဒ",
    cookies: "ကွတ်ကီးမူဝါဒ",
    refundPolicy: "ငွေပြန်အမ်းမူဝါဒ",
    aboutVelnox: "Velnox အကြောင်း",
    company: "ကုမ္ပဏီ",
    openShop: "Velnox ဖြင့် ဆိုင်ဖွင့်ရန်",
    sellerLogin: "ရောင်းသူ ဝင်ရောက်ရန်",
    secureNote: "လုံခြုံသောငွေပေးချေမှု · မှာယူမှု ခြေရာခံနိုင်သည်",
  } satisfies Partial<Dict["footer"]>,
  product: {
    sold: "ရောင်းပြီး {count}",
    soldShort: "ရောင်းပြီး {count}",
    inStockShort: "ပစ္စည်းရှိသည်",
  } satisfies Partial<Dict["product"]>,
  home: {
    heroWelcomeShort: "ကြိုဆိုပါသည် {name}",
    heroTitle: "Velnox သည် သင်နှစ်သက်သောအရာကို မှတ်မိပြီး သင့်အတွက် သင့်တော်သောအရာကို ရွေးပေးသည်",
    heroDesc: "သင့်ထံမှ သင်ယူသည့် စမတ်ကျသောဈေးဝယ်မှု — ပုံမှန်ပစ္စည်းများ၊ တစ်ချက်နှိပ်ဖြင့် ပြန်မှာယူနိုင်ခြင်းနှင့် VelRepeat ဖြင့် နေ့စဉ်သုံးပစ္စည်းများ အလိုအလျောက်",
    shopNow: "စတင်ဈေးဝယ်ရန်",
    myOrders: "ကျွန်ုပ်၏ မှာယူမှုများ",
    categoriesTitle: "လူကြိုက်များသော ကဏ္ဍများ",
    categoriesDesc: "ဖောက်သည်များ လက်ရှိဈေးဝယ်နေသော ကဏ္ဍများ",
    viewAllCategories: "ကဏ္ဍအားလုံး ကြည့်ရန်",
    categoryCount: "{count} ပစ္စည်း",
    continueShoppingTitle: "ကြည့်ထားရာမှ ဆက်လုပ်ပါ",
    continueShoppingDesc: "သင်ပုံမှန်မှာယူသော ပစ္စည်းများ — တစ်ချက်နှိပ်ဖြင့် ပြန်မှာယူနိုင်သည်",
    trendingTitle: "လူကြိုက်များနေသော ပစ္စည်းများ",
    trendingDesc: "Velnox ပေါ်ရှိ အရောင်းရဆုံးအချက်အလက်အပေါ် အခြေခံသည်",
    badgeRecommended: "အကြံပြုသည်",
    velrepeatTitle: "နေ့စဉ်သုံးပစ္စည်းများကို Velnox က စီစဉ်ပေးသည်",
    velrepeatDesc: "သွားတိုက်ဆေး၊ ခေါင်းလျှော်ရည်၊ ဆန်၊ အိမ်သုံးပစ္စည်းများ — VelRepeat ကို တစ်ကြိမ်သတ်မှတ်ပါ၊ Velnox က သတ်မှတ်ထားသော အချိန်ဇယားအတိုင်း ပို့ပေးပါမည်",
    velrepeatHow1: "သင်ပုံမှန်သုံးသော ပစ္စည်းများ ရွေးပါ",
    velrepeatHow2: "အချိန်ဇယားသတ်မှတ်ပါ (အပတ်စဉ် / လစဉ်)",
    velrepeatHow3: "Velnox က အလိုအလျောက် မှာယူပို့ဆောင်ပေးသည်",
    velrepeatCta: "VelRepeat စတင်ရန်",
    velrepeatStep1: "ပစ္စည်းရွေးပါ",
    velrepeatStep1Desc: "သင်ပုံမှန်ဝယ်သော ပစ္စည်းများ၊ ဥပမာ အိမ်သုံးပစ္စည်းများ",
    velrepeatStep2: "အချိန်ဇယားသတ်မှတ်ပါ",
    velrepeatStep2Desc: "တစ်ကြိမ်လျှင် ကြားကာလနှင့် အရေအတွက် ရွေးပါ",
    velrepeatStep3: "အလိုအလျောက်ပို့ဆောင်",
    velrepeatStep3Desc: "Velnox က အချိန်ဇယားအတိုင်း မှာယူပို့ဆောင်သည် — အချိန်မရွေး ပြင်ဆင် သို့မဟုတ် ရပ်နားနိုင်သည်",
    trustTitle: "Velnox ဖြင့် ယုံကြည်စိတ်ချစွာ ဈေးဝယ်ပါ",
    trustSecureTitle: "လုံခြုံသောငွေပေးချေမှု",
    trustSecureDesc: "နည်းလမ်းမျိုးစုံ၊ အမှန်တကယ် စစ်ဆေးနိုင်သည်",
    trustTrackTitle: "ပစ္စည်းခြေရာခံခြင်း",
    trustTrackDesc: "မှာယူမှုနှင့် ပို့ဆောင်မှုအခြေအနေ ကြည့်နိုင်သည်",
    trustReturnTitle: "ငွေပြန်အမ်းခြင်း",
    trustReturnDesc: "မှာယူမှုစာမျက်နှာမှ ပြန်အမ်းရန် တင်သွင်းနိုင်သည်",
    trustSupportTitle: "ဖောက်သည်အကူအညီ",
    trustSupportDesc: "မည်သည့်စာမျက်နှာမှမဆို အဖွဲ့သို့ ဆက်သွယ်နိုင်သည်",
  } satisfies Partial<Dict["home"]>,
  products: {
    applyFilters: "စစ်ထုတ်မှု သုံးရန်",
    resetFilters: "အားလုံးရှင်းရန်",
  } satisfies Partial<Dict["products"]>,
  profile: {
    velrepeat: "VelRepeat",
    velrepeatDesc: "အသုံးပြုနေသော အလိုအလျောက်မှာယူမှုများ",
    account: "ကျွန်ုပ်၏အကောင့်",
    accountDesc: "အမည်၊ ဖုန်းနှင့် အကောင့်အချက်အလက် ပြင်ရန်",
    help: "အကူအညီ",
    helpDesc: "Velnox အဖွဲ့သို့ ဆက်သွယ်ရန်",
    statusActive: "တက်ကြွသောအဖွဲ့ဝင်",
    memberSince: "{date} မှ အဖွဲ့ဝင်",
    editProfile: "ပရိုဖိုင် ပြင်ရန်",
    accountNote: "သင့်အကောင့်သည် သင့် Google အီးမေးလ်နှင့် ချိတ်ဆက်ထားသည် — သင့်မှာယူမှုဒေတာကို လုံခြုံစွာ သိမ်းဆည်းထားသည်",
  } satisfies Partial<Dict["profile"]>,
  account: {
    title: "ကျွန်ုပ်၏အကောင့်",
    desc: "သင့်ကိုယ်ရေးအချက်အလက် စီမံရန်",
    backToProfile: "ပရိုဖိုင်သို့ ပြန်ရန်",
    unnamed: "Velnox အဖွဲ့ဝင်",
    statusActive: "တက်ကြွသောအဖွဲ့ဝင်",
    memberSince: "{date} မှ အဖွဲ့ဝင်",
    editTitle: "ကိုယ်ရေးအချက်အလက်",
    name: "ပြသမည့်အမည်",
    namePlaceholder: "သင့်အမည်",
    nameError: "အမည်သည် ၂–၈၀ လုံး ရှိရမည်",
    phone: "ဖုန်းနံပါတ်",
    phonePlaceholder: "08X-XXX-XXXX",
    phoneHint: "မှာယူမှုနှင့် ပို့ဆောင်မှုအတွက် ဆက်သွယ်ရန် သုံးသည်",
    phoneError: "ဖုန်းနံပါတ် မမှန်ပါ",
    email: "အီးမေးလ်",
    emailLocked: "အီးမေးလ်သည် ဝင်ရောက်သည့် Google အကောင့်မှ လာသည် — Google တွင် ပြောင်းနိုင်သည်",
    save: "သိမ်းရန်",
    saving: "သိမ်းနေသည်...",
    saveSuccess: "သိမ်းပြီးပါပြီ",
    saveFailed: "သိမ်း၍မရပါ ထပ်ကြိုးစားပါ",
  } satisfies Partial<Dict["account"]>,
};

/**
 * All locale dictionaries keyed by language code. Adding a language means
 * adding a dictionary here (plus an entry in ../config).
 */
export const translations: Record<Language, Dict> = {
  th,
  en,
  my: {
    ...myBase,
    header: { ...myBase.header, ...myShopPatch.header },
    footer: { ...myBase.footer, ...myShopPatch.footer },
    product: { ...myBase.product, ...myShopPatch.product },
    home: { ...myBase.home, ...myShopPatch.home },
    products: { ...myBase.products, ...myShopPatch.products },
    profile: { ...myBase.profile, ...myShopPatch.profile },
    account: { ...((myBase as Partial<Dict>).account as Partial<Dict["account"]> | undefined), ...myShopPatch.account },
    auth: { ...myBase.auth, ...myAuthPatch },
  } as Dict,
};
