import Iter "mo:core/Iter";
import Set "mo:core/Set";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";

actor {
  // ExpenseEntry Type
  type ExpenseEntry = {
    id : Nat;
    sheet : Text;
    date : Text;
    companyName : Text;
    category : Text;
    amount : Float;
    notes : Text;
    createdAt : Int;
  };

  module ExpenseEntry {
    public func compare(a : ExpenseEntry, b : ExpenseEntry) : Order.Order {
      Nat.compare(a.id, b.id);
    };
  };

  // Persistent Data Structures
  var nextId = 1;
  let entries = Map.empty<Nat, ExpenseEntry>();
  let categories = Set.empty<Text>();

  // Default Categories
  let defaultCategories = [
    "Auto",
    "Cleaning",
    "Electric",
    "Garbage",
    "Gas/Propane",
    "Groceries",
    "Insurance",
    "Internet",
    "Landscaping/Yard",
    "Mortgage/Rent",
    "Pest Control",
    "Phone",
    "Plumbing",
    "Repairs/Maintenance",
    "Security",
    "Taxes",
    "Trash",
    "Utilities",
    "Water/Sewer",
    "Other",
  ];

  public shared ({ caller }) func addExpenseEntry(sheet : Text, date : Text, companyName : Text, category : Text, amount : Float, notes : Text, createdAt : Int) : async ExpenseEntry {
    let id = nextId;
    nextId += 1;

    let entry : ExpenseEntry = {
      id;
      sheet;
      date;
      companyName;
      category;
      amount;
      notes;
      createdAt;
    };

    entries.add(id, entry);
    entry;
  };

  public shared ({ caller }) func updateExpenseEntry(id : Nat, sheet : Text, date : Text, companyName : Text, category : Text, amount : Float, notes : Text, createdAt : Int) : async () {
    switch (entries.get(id)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?_) {
        let updatedEntry : ExpenseEntry = {
          id;
          sheet;
          date;
          companyName;
          category;
          amount;
          notes;
          createdAt;
        };
        entries.add(id, updatedEntry);
      };
    };
  };

  public shared ({ caller }) func deleteExpenseEntry(id : Nat) : async () {
    if (not entries.containsKey(id)) {
      Runtime.trap("Entry not found");
    };
    entries.remove(id);
  };

  public query ({ caller }) func getEntriesForSheet(sheet : Text) : async [ExpenseEntry] {
    let filtered = entries.values().filter(
      func(entry) {
        entry.sheet == sheet;
      }
    );
    filtered.toArray().sort();
  };

  public query ({ caller }) func getAllEntries() : async [ExpenseEntry] {
    entries.values().toArray().sort();
  };

  public shared ({ caller }) func addCategory(category : Text) : async () {
    if (categories.contains(category)) {
      Runtime.trap("Category already exists");
    };
    categories.add(category);
  };

  public query ({ caller }) func getAllCategories() : async [Text] {
    let customCategories = categories.toArray();
    customCategories.concat(defaultCategories);
  };
};
