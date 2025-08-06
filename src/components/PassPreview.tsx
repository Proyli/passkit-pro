
import { Smartphone, Apple } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PassPreviewProps {
  passData: {
    title: string;
    description: string;
    backgroundColor: string;
    textColor: string;
    type: string;
    fields: Record<string, string>;
  };
}

const PassPreview = ({ passData }: PassPreviewProps) => {
  return (
    <Card className="glass-effect border-white/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Smartphone className="w-5 h-5" />
          <span>Live Preview</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mx-auto max-w-sm">
          {/* iPhone-style frame */}
          <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl">
            <div className="bg-gray-900 rounded-[2rem] p-1">
              <div className="bg-white rounded-[1.75rem] aspect-[9/19.5] p-4 overflow-hidden">
                
                {/* Status bar mockup */}
                <div className="flex justify-between items-center text-xs font-medium text-black mb-4">
                  <span>9:41</span>
                  <div className="flex items-center space-x-1">
                    <div className="w-4 h-2 bg-black rounded-sm"></div>
                    <div className="w-6 h-3 border border-black rounded-sm">
                      <div className="w-4 h-1.5 bg-black rounded-xs m-0.5"></div>
                    </div>
                  </div>
                </div>

                {/* Wallet header */}
                <div className="text-center mb-6">
                  <Apple className="w-8 h-8 mx-auto mb-2" />
                  <h2 className="text-lg font-semibold">Wallet</h2>
                </div>

                {/* Pass preview */}
                <div 
                  className="rounded-xl p-4 shadow-lg transform -rotate-1 hover:rotate-0 transition-transform duration-300"
                  style={{ 
                    backgroundColor: passData.backgroundColor || '#007AFF',
                    color: passData.textColor || '#FFFFFF'
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: passData.textColor || '#FFFFFF' }}>
                        {passData.title || 'Pass Title'}
                      </h3>
                      <p className="text-sm opacity-90" style={{ color: passData.textColor || '#FFFFFF' }}>
                        {passData.description || 'Pass description'}
                      </p>
                    </div>
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold">P</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-white/20 pt-3 mt-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(passData.fields || {}).map(([key, value]) => (
                        <div key={key}>
                          <div className="opacity-70 uppercase font-medium">{key}</div>
                          <div className="font-semibold">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                      <div className="w-8 h-8 bg-black rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PassPreview; // ✅ si quieres exportación por defecto


