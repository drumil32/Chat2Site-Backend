declare global {
    namespace Express {
        interface Request {
            requestId: string;
            finalDomain: string;
            // user?: {
            //     email: string;
            //     organizationId: string;
            // };
        }
    }
}

export { };