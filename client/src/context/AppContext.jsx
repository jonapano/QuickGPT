import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";

const AppContext = createContext()

export const AppContextProvider = ({ children }) => {
    const navigate = useNavigate()
    const [user, setUser] = useState(null);
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const value = {}
    return (
        <AppContextProvider value={value}>
            {children}
        </AppContextProvider>
    )
}

export const useAppContext = () => useContext(AppContext)