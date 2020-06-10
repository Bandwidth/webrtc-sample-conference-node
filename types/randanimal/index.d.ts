declare module "randanimal" {
    function randanimal(adjectives?: number): Promise<string>;

    function randanimalSync(adjectives?: number): string;
}
