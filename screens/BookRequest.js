import React, { Component } from "react";
import {
  View,
  KeyboardAvoidingView,
  StyleSheet,
  Alert,
  Text,
  TouchableHighlight,
  FlatList,
  Image
} from "react-native";
import db from "../config";
import firebase from "firebase";

import MyHeader from "../components/MyHeader";
import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import { BookSearch } from "react-native-google-books";

export default class BookRequestScreen extends Component {
  constructor() {
    super();
    this.state = {
      userId: firebase.auth().currentUser.email,
      bookName: "",
      reasonToRequest: "",
      isBookRequestActive: "",
      requestedBookName: "",
      bookStatus: "",
      requestId: "",
      userDocId: "",
      docId: "",
      dataSource: "",
      showFlatlist: false
    };
  }

  getUniqueId() {
    return Math.random()
      .toString(36)
      .substring(7);
  }

  handleBookRequest = async (bookName, reasonToRequest) => {
    var { userId } = this.state;
    var randomRequestId = this.getUniqueId();
    var books = await BookSearch.searchbook(
      bookName,
      "AIzaSyASyOjOtJla-X-b3io2eLoaUc_bIRFSIIc"
    );
    if (bookName && reasonToRequest) {
      db.collection("requested_books").add({
        user_id: userId,
        book_name: bookName,
        reason_to_request: reasonToRequest,
        request_id: randomRequestId,
        book_status: "requested",
        date: firebase.firestore.FieldValue.serverTimestamp(),
        image_link: books.data[0].volumeInfo.imageLinks.thumbnail
      });

      await this.getRequestedBooks();
      db.collection("users")
        .where("email_id", "==", userId)
        .get()
        .then()
        .then(snapshot => {
          snapshot.forEach(doc => {
            db.collection("users")
              .doc(doc.id)
              .update({
                is_book_request_active: true
              });
          });
        });

      this.setState({
        bookName: "",
        reasonToRequest: "",
        requestId: randomRequestId
      });
      Alert.alert("Book Requested Successfully");
    } else {
      Alert.alert("Fill the details properly");
    }
  };

  getRequestedBooks = () => {
    // getting the requested book
    const { userId } = this.state;
    db.collection("requested_books")
      .where("user_id", "==", userId)
      .get()
      .then(snapshot => {
        snapshot.docs.map(doc => {
          const details = doc.data();
          if (details.book_status !== "received") {
            this.setState({
              requestId: details.request_id,
              requestedBookName: details.book_name,
              bookStatus: details.book_status,
              docId: doc.id,
              requestedImageLink: doc.data().image_link
            });
          }
        });
      });
  };

  getActiveBookRequest = () => {
    const { userId } = this.state;
    db.collection("users")
      .where("email_id", "==", userId)
      .onSnapshot(snapshot => {
        snapshot.docs.map(doc => {
          const details = doc.data();
          this.setState({
            isBookRequestActive: details.is_book_request_active,
            userDocId: doc.id
          });
        });
      });
  };

  componentDidMount() {
    this.getRequestedBooks();
    this.getActiveBookRequest();
  }

  sendNotification = () => {
    //to get the first name and last name
    const { userId, requestId } = this.state;

    db.collection("users")
      .where("email_id", "==", userId)
      .get()
      .then(snapshot => {
        snapshot.docs.map(doc => {
          var name = doc.data().first_name;
          var lastName = doc.data().last_name;
          // to get the donor id and book nam
          db.collection("all_notifications")
            .where("request_id", "==", requestId)
            .get()
            .then(snapshot => {
              snapshot.docs.map(doc => {
                const donorId = doc.data().donor_id;
                const bookName = doc.data().book_name;
                const message = `${name} ${lastName} received the book ${bookName}`;
                //targert user id is the donor id to send notification to the user
                db.collection("all_notifications").add({
                  targeted_user_id: donorId,
                  message: message,
                  notification_status: "unread",
                  book_name: bookName
                });
              });
            });
        });
      });
  };

  updateBookRequestStatus = () => {
    //updating the book status after receiving the book
    const { userId, docId } = this.state;
    db.collection("requested_books")
      .doc(docId)
      .update({
        book_status: "recieved"
      });

    //getting the  doc id to update the users doc
    db.collection("users")
      .where("email_id", "==", userId)
      .get()
      .then(snapshot => {
        snapshot.docs.map(doc => {
          //updating the doc
          db.collection("users")
            .doc(doc.id)
            .update({
              is_book_request_active: false
            });
        });
      });
  };

  receivedBooks = bookName => {
    const { userId, requestId } = this.state;
    db.collection("received_books").add({
      user_id: userId,
      book_name: bookName,
      request_id: requestId,
      bookStatus: "received"
    });
  };

  getBooksFromApi = async bookName => {
    this.setState({ bookName });
    if (bookName.length > 2) {
      var books = await BookSearch.searchbook(
        bookName,
        "AIzaSyASyOjOtJla-X-b3io2eLoaUc_bIRFSIIc"
      );
      this.setState({
        dataSource: books.data,
        showFlatlist: true
      });
    }
  };

  //render Items  functionto render the books from api
  renderItem = ({ item, i }) => (
    <TouchableHighlight
      style={styles.listButtons}
      activeOpacity={0.6}
      underlayColor={"#DDDDDD"}
      onPress={() => {
        this.setState({
          showFlatlist: false,
          bookName: item.volumeInfo.title
        });
      }}
      bottomDivider
    >
      <Text> {item.volumeInfo.title} </Text>
    </TouchableHighlight>
  );

  render() {
    var {
      bookName,
      reasonToRequest,
      isBookRequestActive,
      requestedBookName,
      bookStatus,
      showFlatlist,
      dataSource
    } = this.state;
    return (
      <View style={styles.container}>
        <MyHeader title="Request Book" navigation={this.props.navigation} />
        {isBookRequestActive ? (
          <View style={styles.requestedBookContainer}>
            <View style={styles.requestedBookSubContainer}>
              <Text>Book Name</Text>
              <Text>{requestedBookName}</Text>
            </View>
            <View style={styles.requestedBookSubContainer}>
              <Text>Book Status</Text>
              <Text>{bookStatus}</Text>
            </View>
            <CustomButton
              title={"I recieved the book"}
              onPress={() => {
                const { requestedBookName } = this.state;
                this.sendNotification();
                this.updateBookRequestStatus();
                this.receivedBooks(requestedBookName);
              }}
              style={styles.button1}
              titleStyle={styles.buttonTitle}
            />
          </View>
        ) : (
          <KeyboardAvoidingView style={styles.upperContainer}>
            <CustomInput
              style={[styles.input, { height: 75 }]}
              inputContainerStyle={{ height: 60 }}
              label={"Book Name"}
              labelStyle={{ fontSize: 20 }}
              placeholder={"Book name"}
              onChangeText={text => this.getBooksFromApi(text)}
              onClear={text => this.getBooksFromApi("")}
              value={bookName}
            />
            {showFlatlist ? (
              <FlatList
                data={dataSource}
                renderItem={this.renderItem}
                enableEmptySections={true}
                style={{ marginTop: 10 }}
                keyExtractor={(item, index) => index.toString()}
              />
            ) : (
              <View style={{ alignItems: "center" }}>
                <CustomInput
                  style={[styles.input, { height: 170 }]}
                  inputContainerStyle={{ height: 140 }}
                  label={"Reason"}
                  labelStyle={{ fontSize: 20 }}
                  multiline
                  numberOfLines={8}
                  placeholder={"Why do you need the book"}
                  onChangeText={text => {
                    this.setState({
                      reasonToRequest: text
                    });
                  }}
                  value={reasonToRequest}
                />
                <CustomButton
                  title={"Make a request"}
                  onPress={() =>
                    this.handleBookRequest(bookName, reasonToRequest)
                  }
                  style={styles.button2}
                  titleStyle={styles.buttonTitle}
                />
              </View>
            )}
          </KeyboardAvoidingView>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  upperContainer: {
    flex: 1,
    alignItems: "center"
  },
  input: {
    width: "90%",
    height: 65,
    borderColor: "#6fc0b8",
    borderWidth: 0,
    alignItems: "flex-start",
    marginTop: 30
  },
  button1: {
    marginTop: 20,
    backgroundColor: "#6fc0b8",
    alignSelf: "center"
  },
  button2: {
    width: 200,
    marginTop: 20,
    backgroundColor: "#6fc0b8",
    alignSelf: "center"
  },
  buttonTitle: {
    color: "#fff"
  },
  requestedBookContainer: {
    flex: 1,
    justifyContent: "center"
  },
  requestedBookSubContainer: {
    borderColor: "orange",
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    margin: 10
  },
  listButtons: {
    width: "90%",
    alignItems: "center",
    backgroundColor: "#DDDDDD",
    padding: 10
  },
  image: {
    width: 150,
    height: 150,
    alignSelf: "center",
    borderWidth: 5,
    borderRadius: 10
  }
});
