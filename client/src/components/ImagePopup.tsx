import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ImagePopupProps {
  url: string;
  title?: string;
  className?: string;
}

export default function ImagePopup({ url, title = 'รูปภาพหลักฐาน', className = '' }: ImagePopupProps) {
  const [open, setOpen] = useState(false);
  
  // แปลง URL ให้เป็นรูปแบบ preview เพื่อให้แสดงใน iframe ได้
  let iframeUrl = url;
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    if (id) {
      iframeUrl = `https://drive.google.com/file/d/${id}/preview`;
    }
  } catch (e) {
    // Ignore if not a valid URL
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={`flex items-center gap-2.5 px-5 py-3 bg-surface-container-low text-primary hover:bg-surface-container rounded-2xl border border-outline-variant/30 font-display font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${className}`}>
          <span className="material-symbols-outlined text-xl">image</span>
          ดู{title}
        </button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-5xl h-[70vh] sm:h-[85vh] flex flex-col p-0 rounded-3xl overflow-hidden border-none shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-outline-variant/10 flex-none bg-primary text-white">
          <DialogTitle className="flex items-center justify-between text-lg font-display font-black uppercase tracking-tight">
            <span className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-secondary">photo_camera</span>
              {title}
            </span>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="mr-8 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm font-bold"
            >
              <span className="material-symbols-outlined text-lg">open_in_new</span>
              เปิดในแท็บใหม่
            </a>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full relative bg-surface-container flex items-center justify-center">
          <div className="absolute flex flex-col items-center justify-center text-on-surface-variant/30 z-0 p-8 text-center max-w-xs">
            <span className="material-symbols-outlined text-6xl mb-4 animate-pulse">cloud_download</span>
            <p className="font-display font-bold text-lg text-primary/40">กำลังโหลดหลักฐาน...</p>
            <p className="text-xs mt-3 leading-relaxed">หากพรีวิวไม่แสดงผลโดยอัตโนมัติ กรุณากดปุ่ม <b>"เปิดในแท็บใหม่"</b> ด้านบนขวาเพื่อดูต้นฉบับ</p>
          </div>
          {/* We use an iframe to safely preview the Google Drive file inside the dialog */}
          <iframe 
            src={iframeUrl} 
            className="w-full h-full border-0 absolute inset-0 z-10" 
            allow="autoplay"
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
