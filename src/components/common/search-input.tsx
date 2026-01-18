"use client";

import React from "react";

type SearchInputProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onButtonClick: () => void;
  placeholder?: string;
  buttonText: string;
  disabled?: boolean;
  list?: string;
};

export default function SearchInput({
  value,
  onChange,
  onButtonClick,
  placeholder = "",
  buttonText,
  disabled = false,
  list,
}: SearchInputProps) {
  return (
    <div className="flex justify-center">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        list={list}
        className="bg-[var(--color1)] opacity-80 text-center
        outline-double outline-[var(--color1)] outline-4
        shadow-[inset_0_0_3rem_black] text-[var(--color3)]
        !text-shadow-[0_0_.1rem_black] font-chill
        font-bold p-2 contrast-[2] w-[80%] tracking-wider rounded placeholder:opacity-50"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onButtonClick}
        className="text-[var(--color1)] p-2 outline-double outline-[var(--color1)] outline-4 bg-[var(--color2)] font-black rounded"
      >
        {buttonText}
      </button>
    </div>
  );
}
