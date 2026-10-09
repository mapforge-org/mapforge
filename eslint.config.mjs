import globals from "globals";

export default  {
    languageOptions: {
        globals: {
            ...globals.browser,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },
    rules: {
        "no-unused-vars": ["error", {
            "args": "all",
            "argsIgnorePattern": "^_",
            "varsIgnorePattern": "^_"
        }]
    }
};
