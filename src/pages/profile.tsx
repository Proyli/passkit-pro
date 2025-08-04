import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const Profile = () => {
  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Mi Perfil</h2>

      <Card className="text-center">
        <CardContent className="flex flex-col items-center pt-6 space-y-3">
          <Avatar className="w-20 h-20">
            <AvatarImage src="https://i.pravatar.cc/150?u=usuario" alt="Avatar" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold">Linda Pérez</h3>
          <p className="text-sm text-muted-foreground">lperezd12@miumg.edu.gt</p>
          <p className="text-sm text-muted-foreground">Ingeniería en Sistemas</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
