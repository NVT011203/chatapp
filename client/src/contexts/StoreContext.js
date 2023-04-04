import {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useState,
} from "react";
import { AuthContext } from "./authContext";
import { socket } from "../socket/socket";

const chats = {
    // id: {
    //     id: "",
    //     name: "",
    //     is_group: "",
    //     chat_avatar: "",
    //     members: [],
    //     admins: "",
    //     last_message: "",
    //     background_image: "",
    //     updated_at: "",
    // },
};

const messages = {
    // chat_id: {
    //     id: {
    //         id: "",
    //         chat_id: "",
    //         sender: "",
    //         text: "",
    //         photo_url: "",
    //         file_url: "",
    //         recall: false,
    //         background_image: null,
    //         created_at: "",
    //     },
    // },
};

const users = {
    // id: {
    //     user_id: "",
    //     display_name: "",
    //     avatar_url: "",
    // },
};

const photos = {
    // chat_id: {
    //     id :{
    //         id: "",
    //         photo_url: "",
    //         chat_id: "",
    //         created_at: "",
    //     }
    // }
};

const initialStore = {
    chats,
    messages,
    users,
    photos,
};

const reducer = (state, action) => {
    switch (action.type) {
        case "ADD_MESSAGE": {
            return {
                ...state,
                messages: {
                    ...state.messages,
                    [action.message.chat_id]: state.messages[
                        action.message.chat_id
                    ]
                        ? {
                              ...state.messages[action.message.chat_id],
                              [action.message.id]: action.message,
                          }
                        : { [action.message.id]: action.message },
                },
            };
        }
        case "RECALL_MESSAGE": {
            return {
                ...state,
                messages: {
                    ...state.messages,
                    [action.message.chat_id]: {
                        ...action.message.chat_id,
                        text: null,
                        photo_url: null,
                        file_url: null,
                        recall: true,
                    },
                },
            };
        }
        case "ADD_USERS": {
            return {
                ...state,
                users: { ...state.users, ...action.users },
            };
        }
        case "REMOVE_USER": {
            delete state.users[action.user_id];
            return state;
        }
        case "ADD_CHATS": {
            return {
                ...state,
                chats: { ...state.chats, ...action.chats },
            };
        }
        case "REMOVE_CHAT": {
            delete state.chats[action.chat_id];
            return state;
        }
        case "LEAVE_GROUP": {
            delete state.chats[action.chat_id];
            return state;
        }
        case "ADD_MESSAGES": {
            let messages = state.messages;
            for (const message of action.messages) {
                messages = {
                    ...messages,
                    [message.chat_id]: messages[message.chat_id]
                        ? {
                              ...messages[message.chat_id],
                              [message.id]: message,
                          }
                        : { [message.id]: message },
                };
            }

            return {
                ...state,
                messages,
            };
        }
        case "ADD_PHOTO": {
            return {
                ...state,
                photos: {
                    ...state.photos,
                    [action.photo.chat_id]: state.photos[action.photo.chat_id]
                        ? {
                              ...state.photos[action.photo.chat_id],
                              [action.photo.id]: action.photo,
                          }
                        : { [action.photo.id]: action.photo },
                },
            };
        }
        case "ADD_PHOTOS": {
            let photos = state.photos;
            for (const photo of action.photos) {
                photos = {
                    ...photos,
                    [photo.chat_id]: photos[photo.chat_id]
                        ? {
                              ...photos[photo.chat_id],
                              [photo.id]: photo,
                          }
                        : { [photo.id]: photo },
                };
            }
            return {
                ...state,
                photos,
            };
        }
        case "ADD_MESSAGE_DONE": {
            delete state.messages[action.message.chat_id][action.id];
            return {
                ...state,
                messages: {
                    ...state.messages,
                    [action.message.chat_id]: {
                        ...state.messages[action.message.chat_id],
                        [action.message.id]: action.message,
                    },
                },
            };
        }
        case "REMOVE_MESSAGE_FAILURE": {
            delete state.messages[action.message.chat_id][action.id];
            return state;
        }
        default:
            return state;
    }
};

const sortChats = (chats) => {
    let objsort = {};
    Object.entries(chats).forEach(([key, value]) => {
        objsort[value.updated_at] = key;
    });
    return Object.entries(objsort).sort();
};

export const StoreContext = createContext();

export const StoreContextProvider = ({ children }) => {
    const [store, dispatch] = useReducer(reducer, initialStore);
    const { currentUser } = useContext(AuthContext);

    const [updatedCurrentChat, setUpdatedCurrentChat] = useState({
        chat:
            Object.keys(store.chats).length == 0
                ? undefined
                : store.chats[sortChats(store.chats).reverse()[0][1]],
    });
    useEffect(() => {
        const onSocket = () => {
            socket.emit("join-chats", { chats: Object.keys(store.chats) });
            socket.on("message-receive", ({ message }) => {
                dispatch({
                    type: "ADD_MESSAGE",
                    message: message,
                });
                dispatch({
                    type: "ADD_CHATS",
                    chats: {
                        [message.chat_id]: {
                            ...store.chats[message.chat_id],
                            updated_at: message.created_at,
                            last_message: message.id,
                        },
                    },
                });
            });
            socket.on("photo-receive", ({ photo }) => {
                dispatch({
                    type: "ADD_PHOTO",
                    photo,
                });
            });
            socket.on("added-chat", ({ chat, notices, members }) => {
                console.log({ chat, notices, members });
                dispatch({
                    type: "ADD_USERS",
                    users: members,
                });
                dispatch({
                    type: "ADD_CHATS",
                    chats: {
                        [chat.id]: chat,
                    },
                });
                dispatch({
                    type: "ADD_MESSAGES",
                    messages: notices,
                });
            });
            socket.on("removed-member", ({ member, chat, notice }) => {
                console.log({
                    member,
                    user_id: currentUser.user_id,
                });
                if (member == currentUser.user_id) {
                    dispatch({
                        type: "LEAVE_GROUP",
                        chat_id: chat.id,
                        user_id: member,
                    });
                    setUpdatedCurrentChat((pre) => {
                        return {
                            chat:
                                Object.keys(store.chats).length == 0
                                    ? undefined
                                    : store.chats[
                                          sortChats(store.chats).reverse()[0][1]
                                      ],
                        };
                    });
                } else {
                    dispatch({
                        type: "ADD_CHATS",
                        chats: { [chat.id]: chat },
                    });
                    dispatch({
                        type: "ADD_MESSAGES",
                        messages: notice,
                    });
                }
            });
            socket.on("updated-chat", ({ chat }) => {
                dispatch({
                    type: "ADD_CHATS",
                    chats: {
                        [chat.id]: chat,
                    },
                });
                setUpdatedCurrentChat((pre) => ({
                    chat,
                    updated: !pre.updated,
                }));
            });
            socket.on("deleted-chat", ({ chat }) => {
                dispatch({
                    type: "REMOVE_CHAT",
                    chat_id: chat.id,
                });
                setUpdatedCurrentChat((pre) => {
                    return {
                        chat:
                            Object.keys(store.chats).length == 0
                                ? undefined
                                : store.chats[
                                      sortChats(store.chats).reverse()[0][1]
                                  ],
                    };
                });
            });
        };

        Object.keys(currentUser).length > 0 &&
            store.chats &&
            socket.connected &&
            onSocket();
    }, [currentUser, Object.keys(store.chats).length, socket.id]);

    // useEffect(() => {
    //     console.log(store);
    // }, [store]);
    return (
        <StoreContext.Provider
            value={{
                store,
                dispatch,
                sortChats,
                setUpdatedCurrentChat,
                updatedCurrentChat,
            }}
        >
            {children}
        </StoreContext.Provider>
    );
};
