import { useState, useCallback } from "react";

export function useToast() {
    const [message, setMessage] = useState("");
    const [visible, setVisible] = useState(false);

    const showToast = useCallback((msg) => {
        setMessage(msg);
        setVisible(true);

        setTimeout(() => {
            setVisible(false);
        }, 3000);
    }, []);

    const Toast = () =>
        visible ? (
            <div className="fixed top-5 right-5 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-in fade-in duration-150">
                {message}
            </div>
        ) : null;

    return { showToast, Toast };
}
