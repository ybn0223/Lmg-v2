export interface Minifig {
    minifig_num:      string;
    name:             string;
    num_parts:        number;
    minifig_img_url:  string;
    minifig_url:      string;
    last_modified_dt: Date;
    set_img_url?: string;
    set_url?: string;
}

export interface Set {
    set_num:          string;
    name:             string;
    year:             number;
    theme_id:         number;
    num_parts:        number;
    set_img_url?:      string;
    set_url:          string;
    last_modified_dt: Date;
}

export interface IUser{
    email: string;
    username: string;
    password: string;
    resetToken?: string;
    resetTokenExpiration?: Date;
}


export interface IUserMinifigsCollection{
    userId: string,
    minifigs: string[]
}