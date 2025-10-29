import { useEffect } from "react";
import { initSocket, getSocket } from "../../../../Backend/socket"; // adjust path

export default function EmployeeReport() {
  // ...your existing state

  useEffect(() => {
    const socket = initSocket();

    socket.on("employeeRequestUpdated", (updatedRequest) => {
      setRecentRequests(prev => {
        const tab = tabMap[activeTab];
        if (!prev[tab]) return prev;

        const updatedTabRequests = prev[tab].map(req =>
          req.request_id === updatedRequest.request_id ? updatedRequest : req
        );

        return { ...prev, [tab]: updatedTabRequests };
      });
    });

    return () => {
      socket.off("employeeRequestUpdated"); // cleanup listener
    };
  }, [activeTab]);
}
