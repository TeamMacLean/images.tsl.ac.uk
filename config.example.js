module.exports = {
    appName: "Image Data",
    db: 'imagehog',
    port: "3000",
    secret: "keyboard cats!",
    dataDir: "/mnt/image/",
    HPCRoot: "/tsl/data/image", //no trailing slash
    tmpDir: "/storage/uploads/",
    ldap: {
        url: "ldap://dc.example.org:389",
        bindDn: "",
        bindCredentials: "",
        searchBase: "OU=users,OU=allusers,dc=example,dc=org",
        searchFilter: "(sAMAccountName={{username}})"
    },
    uploadTempDir: '/tmp',
    rootPath: '/my_images', //no trailing slash, this is the local path to the root
    admins: [
        'bob',
        'steve',
        'chris'
    ],
    groups: [
        {
            name: 'Nick\'s Group',
            safeName: 'ngroup',
            image: '/img/groups/nick.jpg',
            adGroups: ['']
        }

    ]
};