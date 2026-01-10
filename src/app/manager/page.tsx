"use client";

import Home from "@/components/common/home";
import { resetUserAndLeagues } from "@/redux/manager/manager-slice";
import { AppDispatch } from "@/redux/store";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

const ManagerPage = () => {
  const dispatch: AppDispatch = useDispatch();
  const [searched, setSearched] = useState("");

  useEffect(() => {
    dispatch(resetUserAndLeagues());
  }, []);

  return (
    <Home
      title="Manager"
      linkTo={`/manager/${searched}/leagues`}
      searched={searched}
      setSearched={setSearched}
      placeholder="Username"
      type="username"
    />
  );
};

export default ManagerPage;
