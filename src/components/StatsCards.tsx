// src/components/StatsCards.tsx
import { Ticket, Users, QrCode, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Props = {
  totalPasses: number;
  installs: number;          // Active Users (aprox = instalaciones en el rango)
  qrScans: number;           // Escaneos en el rango
  conversionRate: number;    // 0-100
  // opcional: cambios vs mes pasado si luego los calculas
  deltaTotalPasses?: string;
  deltaInstalls?: string;
  deltaScans?: string;
  deltaConversion?: string;
};

const StatsCards = ({
  totalPasses,
  installs,
  qrScans,
  conversionRate,
  deltaTotalPasses = '+12%',
  deltaInstalls = '+8%',
  deltaScans = '+23%',
  deltaConversion = '+5%',
}: Props) => {
  const stats = [
    {
      title: 'Total Passes',
      value: totalPasses.toLocaleString(),
      change: deltaTotalPasses,
      icon: Ticket,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Active Users',
      value: installs.toLocaleString(),
      change: deltaInstalls,
      icon: Users,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'QR Scans',
      value: qrScans.toLocaleString(),
      change: deltaScans,
      icon: QrCode,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Conversion Rate',
      value: `${Math.round(conversionRate)}%`,
      change: deltaConversion,
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className="glass-effect border-white/20 hover:shadow-lg transition-all duration-300 animate-fade-in"
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {stat.title}
                </p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-green-600 font-medium mt-1">
                  {stat.change} from last month
                </p>
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
