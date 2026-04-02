interface CrisisResourcesProps {
  urgent?: boolean;
}

export default function CrisisResources({ urgent = false }: CrisisResourcesProps) {
  return (
    <div className={`alert ${urgent ? "alert-error" : "alert-warning"} shadow-md flex flex-col items-start gap-4 p-6 w-full max-w-lg mx-auto border-2 ${urgent ? "border-error" : "border-warning"}`}>
      <h3 className="font-bold text-xl flex items-center gap-2 w-full justify-center">
        {urgent ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            🚨 เรื่องด่วน ขอความช่วยเหลือทันที
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            เราพร้อมช่วยเหลือคุณ
          </>
        )}
      </h3>
      
      <p className="text-base text-center w-full font-medium">คุณไม่ได้อยู่คนเดียว มีคนพร้อมรับฟังและช่วยเหลือคุณเสมอ โทรฟรีได้ตลอด 24 ชั่วโมง</p>
      
      <div className="flex flex-col gap-3 w-full mt-2">
        <a href="tel:1323" className={`btn btn-lg w-full ${urgent ? "btn-error text-white" : "btn-warning"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          สายด่วนสุขภาพจิต 1323
        </a>
        <a href="tel:1387" className="btn btn-lg btn-outline w-full bg-base-100 border-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          สายด่วนช่วยเหลือเด็ก 1387
        </a>
      </div>
    </div>
  );
}
