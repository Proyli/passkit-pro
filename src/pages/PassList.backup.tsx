// @ts-nocheck

import { useEffect, useState } from "react";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DuplicatePassModal } from "@/components/modals/DuplicatePassModal";

interface Pass {
  id: number;
  title: string;
  description: string;
  type: "coupon" | "loyalty" | "event";
  status: "active" | "inactive" | "expired";
  createdAt: string;
}

const statusColors = {
  active: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  inactive: "bg-gray-100 text-gray-800",
};

const statusDotColors = {
  active: "bg-green-500",
  expired: "bg-red-500",
  inactive: "bg-gray-500",
};

const typeColors = {
  coupon: "bg-gray-200 text-gray-800",
  loyalty: "bg-blue-200 text-blue-800",
  event: "bg-purple-200 text-purple-800",
};

const PassList = () => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [isDuplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null);

   const handleOpenDuplicate = (pass: Pass) => {
    console.log("Abriendo modal de duplicado para:", pass.title);
    setSelectedPass(pass);
    setDuplicateModalOpen(true);
  };

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}/passes`)
      .then((res) => setPasses(res.data))
      .catch((err) => {
        console.error("Error al obtener pases:", err);
        alert("Error al cargar los pases desde el backend");
      });
  }, []);
 const handleDuplicate = (duplicatedData: Omit<Pass, "id" | "createdAt">) => {
  axios
    .post(`${import.meta.env.VITE_API_BASE_URL}/passes`, duplicatedData)
    .then((res) => {
      // Agrega el nuevo pase al estado
      setPasses((prev) => [...prev, res.data]);

      // Cierra el modal
      setDuplicateModalOpen(false);

      // Limpia el pase seleccionado
      setSelectedPass(null);
    })
    .catch((err) => {
      console.error("Error al duplicar pase:", err);
      alert("Error al duplicar el pase");
    });
};


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
      {passes.map((pass) => (
        <div
          key={pass.id}
          className="bg-white rounded-2xl shadow-md p-6 flex flex-col justify-between relative"
        >
          <div className="absolute top-4 right-4">
            <div className="group relative">
              <Button variant="ghost" className="text-xl">⋮</Button>
              <div className="hidden group-hover:block absolute z-10 right-0 mt-2 w-40 bg-white border border-gray-200 shadow-md rounded-lg">
                <ul className="text-sm text-gray-700">
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">✏️ Edit</li>
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleOpenDuplicate(pass)}
                  >
                    📄 Duplicate
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">🔳 QR Code</li>
                  <li className="px-4 py-2 text-red-600 hover:bg-red-50 cursor-pointer">🗑️ Delete</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">{pass.title}</h3>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${typeColors[pass.type]}`}
              >
                {pass.type}
              </span>
            </div>
            <p className="text-gray-600 mb-3">{pass.description}</p>
            <p className="text-sm text-gray-500">
              Created: {pass.createdAt.slice(0, 10)} &nbsp; Scans: 123
            </p>
          </div>

          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${statusDotColors[pass.status]}`}></span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full capitalize ${statusColors[pass.status]}`}
              >
                {pass.status}
              </span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="rounded-lg">Apple Wallet</Button>
              <Button variant="outline" className="rounded-lg">Google Pay</Button>
            </div>
          </div>
        </div>
      ))}

      {selectedPass && (
        <DuplicatePassModal
          isOpen={isDuplicateModalOpen}
          onClose={() => setDuplicateModalOpen(false)}
          passData={selectedPass}
          onDuplicate={handleDuplicate}
        />
      )}
    </div>
  );
};

export default PassList;
