import config from "../config/env";
import axios from "axios";
import { LOCAL_STORAGE_KEY } from "../constants";

let BASE_URL = (config["API_BASE_URL"] || "").replace(/\/$/, "");

// If the app is loaded via HTTPS and BASE_URL uses http://, normalize to https://
if (typeof window !== "undefined" && window.location.protocol === "https:") {
  if (BASE_URL.startsWith("http://")) {
    BASE_URL = BASE_URL.replace(/^http:\/\//i, "https://");
    console.warn(
      "Normalized API_BASE_URL to https to avoid mixed-content:",
      BASE_URL
    );
  }
}

export const Urls = {
  login: BASE_URL + "/auth/login",
  getAcess: BASE_URL + "/auth/get-access",
  getUsers: BASE_URL + "/auth/admin/get-users",
  changeStatus: BASE_URL + "/auth/admin/block-unblock-user",
  getPageAccessLink: BASE_URL + "/auth/admin/page-access-link",
  provideAccess: BASE_URL + "/auth/admin/verify-otp",
  getDetails: BASE_URL + "/bill/get-details",
  createBill: BASE_URL + "/bill",
  allBills: BASE_URL + "/bill",
  deleteUser: BASE_URL + "/auth/admin/delete-user",
  addMoreAccessState: BASE_URL + "/auth/admin/add-state-access",
  webIndex: BASE_URL + "/auth/webindex",
};

export const getAcessApi = async (token) => {
  try {
    const { data } = await axios.get(`${Urls.getAcess}/${token}`);
    return { data, error: null };
  } catch (error) {
    let errData = { message: "Network error" };
    try {
      if (error?.response?.data) {
        errData = error.response.data;
      } else if (error?.message) {
        errData = { message: error.message };
      }
    } catch {
      errData = { message: "Network error" };
    }
    console.error("getAcessApi error:", errData, error);
    return { data: null, error: errData };
  }
};

const normalizeError = (error) => {
  let errData = { message: "Network error" };
  try {
    if (error?.response?.data) {
      errData = error.response.data;
    } else if (error?.message) {
      errData = { message: error.message };
    }
  } catch {
    errData = { message: "Network error" };
  }
  return errData;
};

export const getDetailsApi = async (payLoad) => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.get(
      `${Urls.getDetails}?vehicleNo=${payLoad.vehicleNo}`,
      {
        headers: {
          "Content-type": "application/json",
          "x-auth-token": user.token,
        },
      }
    );
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const getAllBillsApi = async (filter) => {
  try {
    const finalUrl = filter ? `${Urls.allBills}?${filter}` : Urls.allBills;
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.get(finalUrl, {
      headers: {
        "Content-type": "application/json",
        "x-auth-token": user.token,
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const createTempUserApi = async () => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.get(Urls.getPageAccessLink, {
      headers: {
        "Content-type": "application/json",
        "x-auth-token": user.token,
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const createBillApi = async (payLoad) => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.post(Urls.createBill, payLoad, {
      headers: {
        "Content-type": "application/json",
        "x-auth-token": user.token,
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const provideAccessApi = async (payLoad) => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.post(Urls.provideAccess, payLoad, {
      headers: {
        "Content-type": "application/json",
        "x-auth-token": user.token,
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const getAllUsersApi = async () => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.get(Urls.getUsers, {
      headers: {
        "Content-type": "application/json",
        "x-auth-token": user.token,
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const changeStatusApi = async (id) => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.post(
      Urls.changeStatus,
      { id },
      {
        headers: {
          "Content-type": "application/json",
          "x-auth-token": user.token,
        },
      }
    );
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const loginApi = async (payLoad) => {
  try {
    const { data } = await axios.post(Urls.login, payLoad, {
      headers: {
        "Content-type": "application/json",
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const deleteUserApi = async (id) => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.delete(`${Urls.deleteUser}/${id}`, {
      headers: {
        "Content-type": "application/json",
        "x-auth-token": user.token,
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const addMoreAccessStateApi = async (payload) => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    const { data } = await axios.post(Urls.addMoreAccessState, payload, {
      headers: {
        "Content-type": "application/json",
        "x-auth-token": user.token,
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};

export const webIndexApi = async (payload) => {
  try {
    const { data } = await axios.post(Urls.webIndex, payload, {
      headers: {
        "Content-type": "application/json",
      },
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
};
