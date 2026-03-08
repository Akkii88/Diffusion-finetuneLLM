"use client";
import dynamic from 'next/dynamic';
import React from 'react';

const NoSSRForce = ({ children }: { children: React.ReactNode }) => (
    <React.Fragment>{children}</React.Fragment>
);

export default dynamic(() => Promise.resolve(NoSSRForce), {
    ssr: false,
});
