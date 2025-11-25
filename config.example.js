module.exports = {
  appName: "Image Data",
  developmentMode: false, // Set to true for local development (bypasses LDAP)
  rethinkdb: {
    host: "localhost", // default host
    port: 28015, // default port
    db: "imagehog", // default database name
  },
  port: "3000",
  secret: "keyboard cats!",
  HPCRoot: "/tsl/data/image", //no trailing slash
  tmpDir: "/storage/uploads/",
  postChangesTo: "",
  tusPath: "/tus",
  ldap: {
    url: "ldap://dc.example.org:389",
    bindDn: "",
    bindCredentials: "",
    searchBase: "OU=users,OU=allusers,dc=example,dc=org",
    searchFilter: "(sAMAccountName={{username}})",
  },
  uploadTempDir: "/tmp",
  rootPath: "/my_images", //no trailing slash, this is the local path to the root
  admins: ["bob", "steve", "chris"],
  groups: [
    {
      name: "Nick's Group",
      safeName: "ngroup",
      image: "/img/groups/nick.jpg",
      adGroups: [""],
    },
  ],
};
