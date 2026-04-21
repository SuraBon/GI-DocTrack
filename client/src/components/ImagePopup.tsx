import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Image as ImageIcon } from 'lucide-react';

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
        <Button variant="outline" size="sm" className={`gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 ${className}`}>
          <ImageIcon className="w-4 h-4" />
          คลิกเพื่อดู {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-none bg-muted/30">
          <DialogTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              {title}
            </span>
            <Button variant="ghost" size="sm" asChild className="mr-6">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 gap-2 font-medium">
                <ExternalLink className="w-4 h-4" />
                เปิดในแท็บใหม่
              </a>
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full relative bg-gray-100 flex items-center justify-center">
          <div className="absolute flex flex-col items-center justify-center text-muted-foreground z-0 p-6 text-center">
            <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>กำลังโหลดรูปภาพ...</p>
            <p className="text-sm mt-2">หากรูปภาพไม่แสดง กรุณากดปุ่ม <b>"เปิดในแท็บใหม่"</b> ด้านบนขวา</p>
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
